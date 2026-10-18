// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";

/// @dev Runs the deploy script against a local chain that pretends to be Monad testnet, then checks the hand-over.
contract DeployTest is Test {
    address admin = makeAddr("multisig");
    address treasury = makeAddr("treasury");
    /// forge's default broadcaster when no --account is given
    address constant DEPLOYER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

    function test_deploy_monadTestnetConfig() public {
        vm.chainId(10143);
        vm.setEnv("NETWORK", "monad-testnet");
        vm.setEnv("LEXARI_ADMIN", vm.toString(admin));
        vm.setEnv("LEXARI_TREASURY", vm.toString(treasury));
        Deploy.Deployed memory d = new Deploy().run();

        assertTrue(d.registry.hasRole(d.registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(d.registry.hasRole(d.registry.PAUSER_ROLE(), admin));
        assertFalse(d.registry.hasRole(d.registry.DEFAULT_ADMIN_ROLE(), DEPLOYER));
        assertFalse(d.registry.hasRole(d.registry.PAUSER_ROLE(), DEPLOYER));
        assertTrue(d.skills.hasRole(d.skills.CURATOR_ROLE(), admin));
        assertFalse(d.skills.hasRole(d.skills.DEFAULT_ADMIN_ROLE(), DEPLOYER));
        assertFalse(d.skills.hasRole(d.skills.CURATOR_ROLE(), DEPLOYER));
        assertFalse(d.vault.hasRole(d.vault.DEFAULT_ADMIN_ROLE(), DEPLOYER));
        assertTrue(d.vault.hasRole(d.vault.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(address(d.vault.registry()), address(d.registry));
        assertEq(d.skills.treasury(), treasury);
        assertEq(d.skills.protocolFeeBps(), 1000);
        assertTrue(d.skills.paymentTokenAllowed(0xf817257fed379853cDe0fa4F97AB987181B1E5Ea));
        assertTrue(d.skills.paymentTokenAllowed(address(0)));
        assertFalse(d.registry.transfersEnabled());
    }

    function test_deploy_refusesWrongChain() public {
        vm.chainId(1);
        vm.setEnv("NETWORK", "monad-testnet");
        vm.setEnv("LEXARI_ADMIN", vm.toString(admin));
        vm.setEnv("LEXARI_TREASURY", vm.toString(treasury));
        Deploy dep = new Deploy();
        vm.expectRevert(bytes("Deploy: RPC chain id does not match the network config"));
        dep.run();
    }
}
