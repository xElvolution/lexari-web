// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILexariAgentRegistry} from "./interfaces/ILexariAgentRegistry.sol";

/// @title LexariSpendVault
/// @author Lexari
/// @notice Holds funds for Lexari agents and lets each agent spend only inside the limits its owner set: a per
///         transaction cap and a daily cap per token, an optional recipient allowlist, and a freeze switch. The owner
///         can always take funds back, even while the vault is paused, so a pause never traps anyone's money.
/// @dev    Who is who comes from LexariAgentRegistry: the agent owner sets policy and withdraws, the agent's operating
///         wallet spends. Token address(0) means the chain's native coin. Balances are tracked per agent and per token
///         and credited with the amount actually received, so fee-on-transfer tokens cannot create phantom balance.
///         Daily windows are UTC days (block.timestamp / 1 days). A token with no policy cannot be spent at all.
contract LexariSpendVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice May pause spending and deposits (withdrawals keep working).
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice The native coin, as a token address.
    address public constant NATIVE = address(0);

    /// @notice One agent's limits for one token, plus what it spent in the current day.
    struct Policy {
        uint128 perTxLimit;
        uint128 dailyLimit;
        uint128 spentToday;
        uint64 day;
        bool enabled;
    }

    /// @notice The registry that names each agent's owner and wallet.
    ILexariAgentRegistry public immutable registry;

    mapping(uint256 agentId => mapping(address token => uint256)) public balanceOf;
    mapping(address token => uint256) public totalHeld;
    mapping(uint256 agentId => mapping(address token => Policy)) private _policy;
    mapping(uint256 agentId => bool) public frozen;
    mapping(uint256 agentId => bool) public allowlistOnly;
    mapping(uint256 agentId => mapping(address recipient => bool)) public allowedRecipient;

    event Deposited(uint256 indexed agentId, address indexed token, address indexed from, uint256 amount);
    event Withdrawn(uint256 indexed agentId, address indexed token, address indexed to, uint256 amount);
    event Spent(
        uint256 indexed agentId, address indexed token, address indexed to, uint256 amount, bytes32 ref, uint256 spentToday
    );
    event PolicySet(uint256 indexed agentId, address indexed token, uint128 perTxLimit, uint128 dailyLimit, bool enabled);
    event FrozenSet(uint256 indexed agentId, bool frozen);
    event AllowlistOnlySet(uint256 indexed agentId, bool enabled);
    event RecipientSet(uint256 indexed agentId, address indexed recipient, bool allowed);

    error ZeroAddress();
    error ZeroAmount();
    error NotAgentOwner(uint256 agentId, address caller);
    error NotAgentWallet(uint256 agentId, address caller);
    error AgentFrozen(uint256 agentId);
    error NoPolicy(uint256 agentId, address token);
    error OverPerTxLimit(uint256 amount, uint256 limit);
    error OverDailyLimit(uint256 wouldSpend, uint256 limit);
    error RecipientNotAllowed(address to);
    error InsufficientBalance(uint256 available, uint256 needed);
    error BadPolicy();
    error NativeValueMismatch();
    error NativeTransferFailed();

    /// @param admin Receives DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
    /// @param registry_ LexariAgentRegistry on this chain.
    constructor(address admin, ILexariAgentRegistry registry_) {
        if (admin == address(0) || address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ------------------------------------------------------------------ funding

    /// @notice Adds native coin to an agent's balance. Anyone may fund any existing agent.
    function depositNative(uint256 agentId) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        registry.agentOwner(agentId); // reverts for an unknown agent
        _credit(agentId, NATIVE, msg.value);
        emit Deposited(agentId, NATIVE, msg.sender, msg.value);
    }

    /// @notice Adds ERC-20 tokens to an agent's balance. Credits what actually arrived.
    function deposit(uint256 agentId, address token, uint256 amount) external whenNotPaused nonReentrant {
        if (token == NATIVE) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        registry.agentOwner(agentId);
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        _credit(agentId, token, received);
        emit Deposited(agentId, token, msg.sender, received);
    }

    /// @notice Takes funds out of an agent's balance. Owner only; works while paused.
    function withdraw(uint256 agentId, address token, uint256 amount, address to) external nonReentrant {
        _onlyOwner(agentId);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _debit(agentId, token, amount);
        _send(token, to, amount);
        emit Withdrawn(agentId, token, to, amount);
    }

    // ------------------------------------------------------------------ spending

    /// @notice The agent pays `to` from its balance, inside its policy.
    /// @param agentId The paying agent. Caller must be its operating wallet.
    /// @param token address(0) for native coin.
    /// @param to Recipient.
    /// @param amount Amount in the token's base units.
    /// @param ref Free reference (for example the Lexari Confirm card id) for the audit log.
    function spend(uint256 agentId, address token, address to, uint256 amount, bytes32 ref)
        external
        whenNotPaused
        nonReentrant
    {
        if (msg.sender != registry.agentWallet(agentId)) revert NotAgentWallet(agentId, msg.sender);
        if (frozen[agentId]) revert AgentFrozen(agentId);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (allowlistOnly[agentId] && !allowedRecipient[agentId][to]) revert RecipientNotAllowed(to);

        Policy storage p = _policy[agentId][token];
        if (!p.enabled) revert NoPolicy(agentId, token);
        if (amount > p.perTxLimit) revert OverPerTxLimit(amount, p.perTxLimit);
        uint64 today = uint64(block.timestamp / 1 days);
        uint256 spent = p.day == today ? p.spentToday : 0;
        uint256 next = spent + amount;
        if (next > p.dailyLimit) revert OverDailyLimit(next, p.dailyLimit);
        p.day = today;
        p.spentToday = uint128(next); // next <= dailyLimit <= type(uint128).max

        _debit(agentId, token, amount);
        _send(token, to, amount);
        emit Spent(agentId, token, to, amount, ref, next);
    }

    // ------------------------------------------------------------------ owner policy

    /// @notice Sets an agent's limits for one token. `dailyLimit` must be at least `perTxLimit`.
    /// @dev Lowering a limit takes effect at once; what was already spent today still counts.
    function setPolicy(uint256 agentId, address token, uint128 perTxLimit, uint128 dailyLimit, bool enabled) external {
        _onlyOwner(agentId);
        if (enabled && (perTxLimit == 0 || dailyLimit < perTxLimit)) revert BadPolicy();
        Policy storage p = _policy[agentId][token];
        p.perTxLimit = perTxLimit;
        p.dailyLimit = dailyLimit;
        p.enabled = enabled;
        emit PolicySet(agentId, token, perTxLimit, dailyLimit, enabled);
    }

    /// @notice Stops (or resumes) every spend by an agent. Owner only.
    function setFrozen(uint256 agentId, bool isFrozen) external {
        _onlyOwner(agentId);
        frozen[agentId] = isFrozen;
        emit FrozenSet(agentId, isFrozen);
    }

    /// @notice When on, the agent may only pay allowlisted recipients. Owner only.
    function setAllowlistOnly(uint256 agentId, bool enabled) external {
        _onlyOwner(agentId);
        allowlistOnly[agentId] = enabled;
        emit AllowlistOnlySet(agentId, enabled);
    }

    /// @notice Adds or removes an allowlisted recipient. Owner only.
    function setRecipient(uint256 agentId, address recipient, bool allowed) external {
        _onlyOwner(agentId);
        if (recipient == address(0)) revert ZeroAddress();
        allowedRecipient[agentId][recipient] = allowed;
        emit RecipientSet(agentId, recipient, allowed);
    }

    // ------------------------------------------------------------------ admin

    /// @notice Stops deposits and spends. Withdrawals keep working.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes deposits and spends.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------ views

    /// @notice An agent's policy for a token.
    function policyOf(uint256 agentId, address token) external view returns (Policy memory) {
        return _policy[agentId][token];
    }

    /// @notice What the agent can still spend today in one transaction, given balance and both limits.
    function spendableNow(uint256 agentId, address token) external view returns (uint256) {
        Policy memory p = _policy[agentId][token];
        if (!p.enabled || frozen[agentId] || paused()) return 0;
        uint256 spent = p.day == uint64(block.timestamp / 1 days) ? p.spentToday : 0;
        uint256 left = p.dailyLimit > spent ? p.dailyLimit - spent : 0;
        if (left > p.perTxLimit) left = p.perTxLimit;
        uint256 bal = balanceOf[agentId][token];
        return left < bal ? left : bal;
    }

    // ------------------------------------------------------------------ internals

    function _credit(uint256 agentId, address token, uint256 amount) private {
        balanceOf[agentId][token] += amount;
        totalHeld[token] += amount;
    }

    function _debit(uint256 agentId, address token, uint256 amount) private {
        uint256 bal = balanceOf[agentId][token];
        if (bal < amount) revert InsufficientBalance(bal, amount);
        unchecked {
            balanceOf[agentId][token] = bal - amount;
            totalHeld[token] -= amount;
        }
    }

    function _send(address token, address to, uint256 amount) private {
        if (token == NATIVE) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _onlyOwner(uint256 agentId) private view {
        if (registry.agentOwner(agentId) != msg.sender) revert NotAgentOwner(agentId, msg.sender);
    }

    /// @dev Plain transfers are refused: native coin must come in through depositNative so it is credited to an agent.
    receive() external payable {
        revert NativeValueMismatch();
    }
}
