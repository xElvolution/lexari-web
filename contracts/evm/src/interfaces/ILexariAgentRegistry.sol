// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

/// @title ILexariAgentRegistry
/// @notice The part of the agent registry other Lexari contracts depend on.
interface ILexariAgentRegistry {
    /// @notice The agent's operating wallet. Reverts for an unknown agent.
    function agentWallet(uint256 agentId) external view returns (address);

    /// @notice The agent's owner (token holder). Reverts for an unknown agent.
    function agentOwner(uint256 agentId) external view returns (address);
}
