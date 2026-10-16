// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILexariAgentRegistry} from "./interfaces/ILexariAgentRegistry.sol";

/// @title LexariSkillRegistry
/// @author Lexari
/// @notice The skills marketplace for the Lexari SDK. Creators publish skills (a content hash and URI per version),
///         set a price in an allowed token and split their revenue between up to eight payees. Agents install skills
///         by paying that price. Lexari takes a protocol fee, capped in code at 30%, and the fee in force at install
///         time is the one charged. Revenue accrues as claimable balances (pull payments), so a payee that cannot
///         receive never blocks an install.
/// @dev    Token address(0) is the native coin. Installs pull the exact price; fee-on-transfer tokens must not be
///         allowed as payment tokens (the admin allowlist is the guard). Pausing stops publishing and installs;
///         claims keep working.
contract LexariSkillRegistry is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice May pause and unpause.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice May delist abusive skills.
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    /// @notice Native coin as a token address.
    address public constant NATIVE = address(0);
    /// @notice 100% in basis points.
    uint16 public constant BPS = 10_000;
    /// @notice Highest protocol fee the admin can ever set.
    uint16 public constant MAX_FEE_BPS = 3_000;
    /// @notice Most payees in one revenue split.
    uint256 public constant MAX_PAYEES = 8;

    /// @notice A published skill.
    struct Skill {
        address creator;
        address paymentToken;
        uint128 price;
        uint32 version;
        bool active;
        bool delisted;
        bytes32 contentHash;
        string uri;
    }

    /// @notice One payee of a creator's revenue split.
    struct Share {
        address payee;
        uint16 bps;
    }

    ILexariAgentRegistry public immutable registry;

    /// @notice Where protocol fees accrue.
    address public treasury;
    /// @notice Current protocol fee.
    uint16 public protocolFeeBps;

    uint256 private _nextSkillId = 1;
    mapping(uint256 skillId => Skill) private _skills;
    mapping(uint256 skillId => Share[]) private _splits;
    mapping(address token => bool) public paymentTokenAllowed;
    /// @notice Version of a skill an agent installed (0 = not installed).
    mapping(uint256 agentId => mapping(uint256 skillId => uint32)) public installedVersion;
    /// @notice What each payee can claim, per token.
    mapping(address payee => mapping(address token => uint256)) public claimable;

    event SkillPublished(
        uint256 indexed skillId, address indexed creator, address paymentToken, uint128 price, bytes32 contentHash, string uri
    );
    event SkillVersioned(uint256 indexed skillId, uint32 version, bytes32 contentHash, string uri);
    event SkillPriceSet(uint256 indexed skillId, address paymentToken, uint128 price);
    event SkillActiveSet(uint256 indexed skillId, bool active);
    event SkillDelisted(uint256 indexed skillId, bool delisted);
    event SplitSet(uint256 indexed skillId, address[] payees, uint16[] bps);
    event SkillInstalled(
        uint256 indexed skillId, uint256 indexed agentId, address indexed payer, uint32 version, uint256 price, uint256 fee
    );
    event Claimed(address indexed payee, address indexed token, uint256 amount);
    event TreasurySet(address indexed treasury);
    event ProtocolFeeSet(uint16 bps);
    event PaymentTokenSet(address indexed token, bool allowed);

    error ZeroAddress();
    error NotCreator(uint256 skillId, address caller);
    error UnknownSkill(uint256 skillId);
    error SkillUnavailable(uint256 skillId);
    error TokenNotAllowed(address token);
    error BadSplit();
    error FeeTooHigh(uint16 bps);
    error NotOwnerOrAgent(uint256 agentId, address caller);
    error AlreadyInstalled(uint256 agentId, uint256 skillId, uint32 version);
    error WrongNativeValue(uint256 sent, uint256 price);
    error NothingToClaim();
    error NativeTransferFailed();
    error EmptyURI();

    /// @param admin DEFAULT_ADMIN_ROLE, PAUSER_ROLE and CURATOR_ROLE.
    /// @param registry_ LexariAgentRegistry on this chain.
    /// @param treasury_ Receives protocol fees.
    /// @param feeBps Initial protocol fee, at most MAX_FEE_BPS.
    constructor(address admin, ILexariAgentRegistry registry_, address treasury_, uint16 feeBps) {
        if (admin == address(0) || address(registry_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh(feeBps);
        registry = registry_;
        treasury = treasury_;
        protocolFeeBps = feeBps;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(CURATOR_ROLE, admin);
        emit TreasurySet(treasury_);
        emit ProtocolFeeSet(feeBps);
    }

    // ------------------------------------------------------------------ creators

    /// @notice Publishes a skill as version 1. The caller is its creator.
    /// @param uri Where the skill package lives (IPFS, Arweave or https).
    /// @param contentHash keccak256 of the package, so installs can verify it.
    /// @param paymentToken Allowed payment token (address(0) for native).
    /// @param price Price per install in base units (0 = free).
    /// @param payees Revenue split payees. Empty means 100% to the creator.
    /// @param bps Shares in basis points, summing to 10 000.
    function publish(
        string calldata uri,
        bytes32 contentHash,
        address paymentToken,
        uint128 price,
        address[] calldata payees,
        uint16[] calldata bps
    ) external whenNotPaused returns (uint256 skillId) {
        if (bytes(uri).length == 0) revert EmptyURI();
        if (!paymentTokenAllowed[paymentToken]) revert TokenNotAllowed(paymentToken);
        skillId = _nextSkillId++;
        _skills[skillId] = Skill({
            creator: msg.sender,
            paymentToken: paymentToken,
            price: price,
            version: 1,
            active: true,
            delisted: false,
            contentHash: contentHash,
            uri: uri
        });
        _setSplit(skillId, payees, bps);
        emit SkillPublished(skillId, msg.sender, paymentToken, price, contentHash, uri);
    }

    /// @notice Ships a new version. Agents on an older version may install again to upgrade (and pay again).
    function publishVersion(uint256 skillId, string calldata uri, bytes32 contentHash) external whenNotPaused {
        Skill storage s = _creatorSkill(skillId);
        if (bytes(uri).length == 0) revert EmptyURI();
        s.version += 1;
        s.uri = uri;
        s.contentHash = contentHash;
        emit SkillVersioned(skillId, s.version, contentHash, uri);
    }

    /// @notice Changes the price or payment token. Affects future installs only.
    function setPrice(uint256 skillId, address paymentToken, uint128 price) external {
        Skill storage s = _creatorSkill(skillId);
        if (!paymentTokenAllowed[paymentToken]) revert TokenNotAllowed(paymentToken);
        s.paymentToken = paymentToken;
        s.price = price;
        emit SkillPriceSet(skillId, paymentToken, price);
    }

    /// @notice Replaces the revenue split. Affects future installs only.
    function setSplit(uint256 skillId, address[] calldata payees, uint16[] calldata bps) external {
        _creatorSkill(skillId);
        _setSplit(skillId, payees, bps);
    }

    /// @notice The creator lists or unlists a skill.
    function setActive(uint256 skillId, bool active) external {
        _creatorSkill(skillId).active = active;
        emit SkillActiveSet(skillId, active);
    }

    // ------------------------------------------------------------------ installs

    /// @notice Installs the current version of a skill on an agent and pays for it.
    /// @dev Caller must be the agent owner or the agent's wallet. Native price: send exactly `price`.
    function install(uint256 skillId, uint256 agentId) external payable whenNotPaused nonReentrant {
        Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert UnknownSkill(skillId);
        if (!s.active || s.delisted) revert SkillUnavailable(skillId);
        if (msg.sender != registry.agentOwner(agentId) && msg.sender != registry.agentWallet(agentId)) {
            revert NotOwnerOrAgent(agentId, msg.sender);
        }
        uint32 v = s.version;
        if (installedVersion[agentId][skillId] == v) revert AlreadyInstalled(agentId, skillId, v);
        installedVersion[agentId][skillId] = v;

        address token = s.paymentToken;
        uint256 price = s.price;
        if (token == NATIVE) {
            if (msg.value != price) revert WrongNativeValue(msg.value, price);
        } else {
            if (msg.value != 0) revert WrongNativeValue(msg.value, 0);
            if (price != 0) IERC20(token).safeTransferFrom(msg.sender, address(this), price);
        }

        uint256 fee = price * protocolFeeBps / BPS;
        if (fee != 0) claimable[treasury][token] += fee;
        uint256 rest = price - fee;
        if (rest != 0) {
            Share[] storage split = _splits[skillId];
            uint256 n = split.length;
            if (n == 0) {
                claimable[s.creator][token] += rest;
            } else {
                uint256 paid = 0;
                for (uint256 i; i < n - 1; ++i) {
                    uint256 part = rest * split[i].bps / BPS;
                    claimable[split[i].payee][token] += part;
                    paid += part;
                }
                claimable[split[n - 1].payee][token] += rest - paid; // rounding dust to the last payee
            }
        }
        emit SkillInstalled(skillId, agentId, msg.sender, v, price, fee);
    }

    /// @notice Sends the caller everything they earned in `token`. Works while paused.
    function claim(address token) external nonReentrant {
        uint256 amount = claimable[msg.sender][token];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender][token] = 0;
        if (token == NATIVE) {
            (bool ok,) = msg.sender.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        emit Claimed(msg.sender, token, amount);
    }

    // ------------------------------------------------------------------ admin

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setProtocolFee(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh(bps);
        protocolFeeBps = bps;
        emit ProtocolFeeSet(bps);
    }

    /// @notice Allows or disallows a payment token for new prices. Existing prices keep working.
    function setPaymentToken(address token, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paymentTokenAllowed[token] = allowed;
        emit PaymentTokenSet(token, allowed);
    }

    /// @notice A curator hides (or restores) a skill from installs.
    function setDelisted(uint256 skillId, bool delisted) external onlyRole(CURATOR_ROLE) {
        Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert UnknownSkill(skillId);
        s.delisted = delisted;
        emit SkillDelisted(skillId, delisted);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------ views

    function skill(uint256 skillId) external view returns (Skill memory) {
        Skill memory s = _skills[skillId];
        if (s.creator == address(0)) revert UnknownSkill(skillId);
        return s;
    }

    function splitOf(uint256 skillId) external view returns (Share[] memory) {
        return _splits[skillId];
    }

    function totalSkills() external view returns (uint256) {
        return _nextSkillId - 1;
    }

    // ------------------------------------------------------------------ internals

    function _creatorSkill(uint256 skillId) private view returns (Skill storage s) {
        s = _skills[skillId];
        if (s.creator == address(0)) revert UnknownSkill(skillId);
        if (s.creator != msg.sender) revert NotCreator(skillId, msg.sender);
    }

    function _setSplit(uint256 skillId, address[] calldata payees, uint16[] calldata bps) private {
        uint256 n = payees.length;
        if (n != bps.length || n > MAX_PAYEES) revert BadSplit();
        delete _splits[skillId];
        uint256 sum = 0;
        for (uint256 i; i < n; ++i) {
            if (payees[i] == address(0) || bps[i] == 0) revert BadSplit();
            sum += bps[i];
            _splits[skillId].push(Share({payee: payees[i], bps: bps[i]}));
        }
        if (n != 0 && sum != BPS) revert BadSplit();
        emit SplitSet(skillId, payees, bps);
    }
}
