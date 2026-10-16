// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {LexariAgentRegistry} from "../src/LexariAgentRegistry.sol";
import {LexariSpendVault} from "../src/LexariSpendVault.sol";
import {LexariSkillRegistry} from "../src/LexariSkillRegistry.sol";

/// @title Deploy
/// @notice Deploys the Lexari EVM contracts to one network, configured from deployments/config/<NETWORK>.json.
/// @dev No private key lives here or in env. The broadcaster comes from the forge CLI (--account <keystore>,
///      --ledger or --trezor), for example:
///
///        NETWORK=monad-testnet LEXARI_ADMIN=0x... LEXARI_TREASURY=0x... \
///        forge script script/Deploy.s.sol --rpc-url monad_testnet --account lexari-deployer --broadcast
///
///      Without --broadcast it is a dry run (simulation only). The script refuses to run when the RPC's chain id
///      differs from the config file, so a mainnet config can never land on a testnet or the reverse.
///
///      Admin roles go to LEXARI_ADMIN (a multisig on mainnet). The broadcaster only receives a temporary admin role
///      long enough to apply the config, then renounces it, so the deployer key keeps no power afterwards.
contract Deploy is Script {
    using stdJson for string;

    struct Deployed {
        LexariAgentRegistry registry;
        LexariSpendVault vault;
        LexariSkillRegistry skills;
    }

    function run() external returns (Deployed memory d) {
        string memory network = vm.envString("NETWORK");
        address admin = vm.envAddress("LEXARI_ADMIN");
        address treasury = vm.envAddress("LEXARI_TREASURY");
        string memory cfg = vm.readFile(string.concat(vm.projectRoot(), "/deployments/config/", network, ".json"));

        uint256 chainId = cfg.readUint(".chainId");
        require(block.chainid == chainId, "Deploy: RPC chain id does not match the network config");
        uint16 feeBps = uint16(cfg.readUint(".protocolFeeBps"));
        address[] memory tokens = cfg.readAddressArray(".paymentTokens");
        bool transfers = cfg.readBool(".transfersEnabled");

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        // The deployer is admin only while it configures, then hands everything to `admin`.
        d.registry = new LexariAgentRegistry(deployer);
        d.vault = new LexariSpendVault(admin, d.registry);
        d.skills = new LexariSkillRegistry(deployer, d.registry, treasury, feeBps);

        for (uint256 i; i < tokens.length; ++i) d.skills.setPaymentToken(tokens[i], true);
        if (transfers) d.registry.setTransfersEnabled(true);

        _handOver(address(d.registry), deployer, admin, _registryRoles(d.registry));
        _handOver(address(d.skills), deployer, admin, _skillRoles(d.skills));
        vm.stopBroadcast();

        console2.log("network", network);
        console2.log("LexariAgentRegistry", address(d.registry));
        console2.log("LexariSpendVault", address(d.vault));
        console2.log("LexariSkillRegistry", address(d.skills));
    }

    function _registryRoles(LexariAgentRegistry r) private view returns (bytes32[] memory roles) {
        roles = new bytes32[](2);
        roles[0] = r.PAUSER_ROLE();
        roles[1] = r.DEFAULT_ADMIN_ROLE();
    }

    function _skillRoles(LexariSkillRegistry s) private view returns (bytes32[] memory roles) {
        roles = new bytes32[](3);
        roles[0] = s.PAUSER_ROLE();
        roles[1] = s.CURATOR_ROLE();
        roles[2] = s.DEFAULT_ADMIN_ROLE();
    }

    /// @dev Grants every role to `admin`, then the deployer renounces them (DEFAULT_ADMIN_ROLE last).
    function _handOver(address target, address deployer, address admin, bytes32[] memory roles) private {
        if (admin == deployer) return;
        IRoles c = IRoles(target);
        for (uint256 i; i < roles.length; ++i) c.grantRole(roles[i], admin);
        for (uint256 i; i < roles.length; ++i) c.renounceRole(roles[i], deployer);
    }
}

interface IRoles {
    function grantRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address callerConfirmation) external;
}
