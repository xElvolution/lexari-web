// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ILexariAgentRegistry} from "./interfaces/ILexariAgentRegistry.sol";

/// @title LexariAgentRegistry
/// @author Lexari
/// @notice Onchain identity for Lexari agents. Each agent is an ERC-721 token held by its owner (the person) and
///         bound to exactly one operating wallet (the agent's own address, the key Lexari custodies off chain).
///         The token carries a metadata URI (name, face, role), a personality hash (commitment to the personality
///         settings) and a memory root (commitment to the agent's Engram memory snapshot).
/// @dev    Agent tokens are non-transferable by default, because an agent's wallet and memory are personal. The admin
///         can turn transfers on later (for example when agents become tradeable). Minting, transfers and every update
///         stop while paused. Only commitments go on chain: no memory content, no personality text, no keys.
contract LexariAgentRegistry is ERC721, AccessControl, Pausable, ILexariAgentRegistry {
    /// @notice May pause and unpause the registry.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice May register agents on behalf of someone else (Lexari's sponsored mint).
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice Everything stored for one agent.
    /// @param wallet The agent's operating wallet. Unique across the registry.
    /// @param personalityHash keccak256 of the canonical personality settings JSON.
    /// @param memoryRoot Commitment (for example a Merkle root) to the latest Engram memory snapshot.
    /// @param createdAt Block timestamp of registration.
    /// @param updatedAt Block timestamp of the last change.
    /// @param metadataURI Token metadata (ERC-721 JSON).
    struct Agent {
        address wallet;
        bytes32 personalityHash;
        bytes32 memoryRoot;
        uint64 createdAt;
        uint64 updatedAt;
        string metadataURI;
    }

    uint256 private _nextId = 1;
    mapping(uint256 agentId => Agent) private _agents;
    mapping(address wallet => uint256 agentId) private _byWallet;

    /// @notice True once an agent was retired.
    mapping(uint256 agentId => bool) public retired;

    /// @notice True when agent tokens may change owner.
    bool public transfersEnabled;

    /// @notice An agent was registered.
    event AgentRegistered(
        uint256 indexed agentId, address indexed owner, address indexed wallet, bytes32 personalityHash, string metadataURI
    );
    /// @notice An agent's operating wallet was rotated.
    event AgentWalletChanged(uint256 indexed agentId, address indexed previousWallet, address indexed newWallet);
    /// @notice An agent's metadata URI changed (ERC-4906 style signal is emitted as well).
    event MetadataURIChanged(uint256 indexed agentId, string metadataURI);
    /// @notice An agent's personality commitment changed.
    event PersonalityHashChanged(uint256 indexed agentId, bytes32 personalityHash);
    /// @notice An agent's memory commitment changed. `by` is the owner or the agent wallet.
    event MemoryRootChanged(uint256 indexed agentId, bytes32 memoryRoot, address indexed by);
    /// @notice An agent was retired by its owner.
    event AgentRetired(uint256 indexed agentId, address indexed wallet);
    /// @notice Transfers were switched on or off.
    event TransfersEnabledSet(bool enabled);
    /// @notice ERC-4906: metadata of a token changed.
    event MetadataUpdate(uint256 _tokenId);

    error ZeroAddress();
    error WalletTaken(address wallet, uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error NotOwnerOrAgent(uint256 agentId, address caller);
    error UnknownAgent(uint256 agentId);
    error NotAllowedToRegisterFor(address to);
    error TransfersDisabled();
    error EmptyURI();
    error AgentIsRetired(uint256 agentId);

    /// @param admin Receives DEFAULT_ADMIN_ROLE and PAUSER_ROLE (use a multisig on mainnet).
    constructor(address admin) ERC721("Lexari Agent", "LXAGENT") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ------------------------------------------------------------------ registration

    /// @notice Registers a new agent and mints its token to `to`.
    /// @dev Anyone may register for themselves; registering for another address needs REGISTRAR_ROLE.
    /// @param to The agent owner.
    /// @param wallet The agent's operating wallet (must not already belong to an agent).
    /// @param metadataURI ERC-721 metadata URI.
    /// @param personalityHash Commitment to the personality settings.
    /// @return agentId The new agent's id (token id), starting at 1.
    function register(address to, address wallet, string calldata metadataURI, bytes32 personalityHash)
        external
        whenNotPaused
        returns (uint256 agentId)
    {
        if (to == address(0) || wallet == address(0)) revert ZeroAddress();
        if (to != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotAllowedToRegisterFor(to);
        if (bytes(metadataURI).length == 0) revert EmptyURI();
        uint256 taken = _byWallet[wallet];
        if (taken != 0) revert WalletTaken(wallet, taken);

        agentId = _nextId++;
        _agents[agentId] = Agent({
            wallet: wallet,
            personalityHash: personalityHash,
            memoryRoot: bytes32(0),
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            metadataURI: metadataURI
        });
        _byWallet[wallet] = agentId;
        _safeMint(to, agentId);
        emit AgentRegistered(agentId, to, wallet, personalityHash, metadataURI);
    }

    /// @notice Retires an agent: its wallet is unbound (and free to bind again) and it can no longer be updated.
    /// @dev The token is kept, not burned, so the owner keeps proving ownership to other contracts (for example to
    ///      withdraw what is left in LexariSpendVault). A retired agent has no wallet, so it can never spend.
    /// @param agentId The agent to retire. Caller must own it.
    function retire(uint256 agentId) external whenNotPaused {
        _onlyActiveOwner(agentId);
        Agent storage a = _agents[agentId];
        address wallet = a.wallet;
        delete _byWallet[wallet];
        a.wallet = address(0);
        a.updatedAt = uint64(block.timestamp);
        retired[agentId] = true;
        emit AgentRetired(agentId, wallet);
    }

    // ------------------------------------------------------------------ updates

    /// @notice Points an agent at a new operating wallet (key rotation). Owner only.
    function setAgentWallet(uint256 agentId, address newWallet) external whenNotPaused {
        _onlyActiveOwner(agentId);
        if (newWallet == address(0)) revert ZeroAddress();
        uint256 taken = _byWallet[newWallet];
        if (taken != 0) revert WalletTaken(newWallet, taken);
        Agent storage a = _agents[agentId];
        address previous = a.wallet;
        delete _byWallet[previous];
        _byWallet[newWallet] = agentId;
        a.wallet = newWallet;
        a.updatedAt = uint64(block.timestamp);
        emit AgentWalletChanged(agentId, previous, newWallet);
    }

    /// @notice Updates the metadata URI. Owner only.
    function setMetadataURI(uint256 agentId, string calldata metadataURI) external whenNotPaused {
        _onlyActiveOwner(agentId);
        if (bytes(metadataURI).length == 0) revert EmptyURI();
        Agent storage a = _agents[agentId];
        a.metadataURI = metadataURI;
        a.updatedAt = uint64(block.timestamp);
        emit MetadataURIChanged(agentId, metadataURI);
        emit MetadataUpdate(agentId);
    }

    /// @notice Updates the personality commitment. Owner only.
    function setPersonalityHash(uint256 agentId, bytes32 personalityHash) external whenNotPaused {
        _onlyActiveOwner(agentId);
        Agent storage a = _agents[agentId];
        a.personalityHash = personalityHash;
        a.updatedAt = uint64(block.timestamp);
        emit PersonalityHashChanged(agentId, personalityHash);
    }

    /// @notice Updates the memory commitment. The owner or the agent's own wallet may call it, so the agent can
    ///         checkpoint its Engram memory without asking the owner to sign every snapshot.
    function setMemoryRoot(uint256 agentId, bytes32 memoryRoot) external whenNotPaused {
        address owner = _requireOwned(agentId);
        if (retired[agentId]) revert AgentIsRetired(agentId);
        if (msg.sender != owner && msg.sender != _agents[agentId].wallet) revert NotOwnerOrAgent(agentId, msg.sender);
        Agent storage a = _agents[agentId];
        a.memoryRoot = memoryRoot;
        a.updatedAt = uint64(block.timestamp);
        emit MemoryRootChanged(agentId, memoryRoot, msg.sender);
    }

    // ------------------------------------------------------------------ admin

    /// @notice Turns agent token transfers on or off. Admin only.
    function setTransfersEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transfersEnabled = enabled;
        emit TransfersEnabledSet(enabled);
    }

    /// @notice Stops registration, updates and transfers.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes the registry.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------ views

    /// @notice The stored record of an agent.
    function agent(uint256 agentId) external view returns (Agent memory) {
        _requireOwned(agentId);
        return _agents[agentId];
    }

    /// @inheritdoc ILexariAgentRegistry
    function agentWallet(uint256 agentId) external view returns (address) {
        _requireOwned(agentId);
        return _agents[agentId].wallet;
    }

    /// @inheritdoc ILexariAgentRegistry
    function agentOwner(uint256 agentId) external view returns (address) {
        return _requireOwned(agentId);
    }

    /// @notice The agent bound to `wallet`, or 0 when none.
    function agentIdOf(address wallet) external view returns (uint256) {
        return _byWallet[wallet];
    }

    /// @notice Number of agent ids ever issued (retired ones included).
    function totalIssued() external view returns (uint256) {
        return _nextId - 1;
    }

    /// @inheritdoc ERC721
    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _agents[agentId].metadataURI;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return interfaceId == bytes4(0x49064906) || ERC721.supportsInterface(interfaceId)
            || AccessControl.supportsInterface(interfaceId);
    }

    // ------------------------------------------------------------------ internals

    /// @dev Mints always pass (when not paused); owner-to-owner moves need transfersEnabled.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        _requireNotPaused();
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !transfersEnabled) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    function _onlyActiveOwner(uint256 agentId) private view {
        if (_requireOwned(agentId) != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        if (retired[agentId]) revert AgentIsRetired(agentId);
    }
}
