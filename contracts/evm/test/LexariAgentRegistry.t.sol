// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LexariAgentRegistry} from "../src/LexariAgentRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract LexariAgentRegistryTest is Test {
    LexariAgentRegistry reg;
    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address aliceAgent = makeAddr("aliceAgent");
    address registrar = makeAddr("registrar");
    bytes32 constant P = keccak256("personality");

    function setUp() public {
        reg = new LexariAgentRegistry(admin);
        bytes32 role = reg.REGISTRAR_ROLE();
        vm.prank(admin);
        reg.grantRole(role, registrar);
    }

    function _register() internal returns (uint256 id) {
        vm.prank(alice);
        id = reg.register(alice, aliceAgent, "ipfs://agent", P);
    }

    function test_constructor_rejectsZeroAdmin() public {
        vm.expectRevert(LexariAgentRegistry.ZeroAddress.selector);
        new LexariAgentRegistry(address(0));
    }

    function test_register_self() public {
        vm.expectEmit(true, true, true, true);
        emit LexariAgentRegistry.AgentRegistered(1, alice, aliceAgent, P, "ipfs://agent");
        uint256 id = _register();
        assertEq(id, 1);
        assertEq(reg.ownerOf(id), alice);
        assertEq(reg.agentWallet(id), aliceAgent);
        assertEq(reg.agentOwner(id), alice);
        assertEq(reg.agentIdOf(aliceAgent), id);
        assertEq(reg.tokenURI(id), "ipfs://agent");
        LexariAgentRegistry.Agent memory a = reg.agent(id);
        assertEq(a.personalityHash, P);
        assertEq(a.memoryRoot, bytes32(0));
        assertEq(a.createdAt, block.timestamp);
        assertEq(reg.totalIssued(), 1);
    }

    function test_register_forOtherNeedsRole() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotAllowedToRegisterFor.selector, alice));
        reg.register(alice, aliceAgent, "ipfs://x", P);
        vm.prank(registrar);
        uint256 id = reg.register(alice, aliceAgent, "ipfs://x", P);
        assertEq(reg.ownerOf(id), alice);
    }

    function test_register_rejects() public {
        vm.startPrank(alice);
        vm.expectRevert(LexariAgentRegistry.ZeroAddress.selector);
        reg.register(alice, address(0), "u", P);
        vm.expectRevert(LexariAgentRegistry.EmptyURI.selector);
        reg.register(alice, aliceAgent, "", P);
        reg.register(alice, aliceAgent, "u", P);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.WalletTaken.selector, aliceAgent, 1));
        reg.register(alice, aliceAgent, "u", P);
        vm.stopPrank();
    }

    function test_updates_ownerOnly() public {
        uint256 id = _register();
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotAgentOwner.selector, id, bob));
        reg.setMetadataURI(id, "u2");
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotAgentOwner.selector, id, bob));
        reg.setPersonalityHash(id, bytes32(uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotAgentOwner.selector, id, bob));
        reg.setAgentWallet(id, bob);
        vm.stopPrank();

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, true);
        emit LexariAgentRegistry.MetadataUpdate(id);
        reg.setMetadataURI(id, "u2");
        reg.setPersonalityHash(id, bytes32(uint256(7)));
        vm.stopPrank();
        assertEq(reg.tokenURI(id), "u2");
        assertEq(reg.agent(id).personalityHash, bytes32(uint256(7)));
    }

    function test_memoryRoot_ownerOrAgent() public {
        uint256 id = _register();
        vm.prank(aliceAgent);
        reg.setMemoryRoot(id, bytes32(uint256(1)));
        assertEq(reg.agent(id).memoryRoot, bytes32(uint256(1)));
        vm.prank(alice);
        reg.setMemoryRoot(id, bytes32(uint256(2)));
        assertEq(reg.agent(id).memoryRoot, bytes32(uint256(2)));
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotOwnerOrAgent.selector, id, bob));
        reg.setMemoryRoot(id, bytes32(uint256(3)));
    }

    function test_rotateWallet() public {
        uint256 id = _register();
        address next = makeAddr("next");
        vm.prank(alice);
        reg.setAgentWallet(id, next);
        assertEq(reg.agentWallet(id), next);
        assertEq(reg.agentIdOf(next), id);
        assertEq(reg.agentIdOf(aliceAgent), 0);
        // old wallet lost its rights
        vm.prank(aliceAgent);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotOwnerOrAgent.selector, id, aliceAgent));
        reg.setMemoryRoot(id, bytes32(uint256(1)));
    }

    function test_retire() public {
        uint256 id = _register();
        vm.prank(alice);
        reg.retire(id);
        assertTrue(reg.retired(id));
        assertEq(reg.agentWallet(id), address(0));
        assertEq(reg.agentIdOf(aliceAgent), 0);
        assertEq(reg.ownerOf(id), alice); // token kept
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.AgentIsRetired.selector, id));
        reg.setMetadataURI(id, "x");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.AgentIsRetired.selector, id));
        reg.setMemoryRoot(id, bytes32(0));
        // wallet is free again
        vm.prank(bob);
        uint256 id2 = reg.register(bob, aliceAgent, "u", P);
        assertEq(id2, 2);
    }

    function test_transfers_disabledByDefault() public {
        uint256 id = _register();
        vm.prank(alice);
        vm.expectRevert(LexariAgentRegistry.TransfersDisabled.selector);
        reg.transferFrom(alice, bob, id);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, bytes32(0)));
        reg.setTransfersEnabled(true);

        vm.prank(admin);
        reg.setTransfersEnabled(true);
        vm.prank(alice);
        reg.transferFrom(alice, bob, id);
        assertEq(reg.agentOwner(id), bob);
    }

    function test_pause() public {
        uint256 id = _register();
        vm.prank(alice);
        vm.expectRevert();
        reg.pause();
        vm.prank(admin);
        reg.pause();
        vm.startPrank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        reg.register(alice, makeAddr("w2"), "u", P);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        reg.setMetadataURI(id, "x");
        vm.stopPrank();
        vm.prank(admin);
        reg.unpause();
        vm.prank(alice);
        reg.setMetadataURI(id, "x");
    }

    function test_unknownAgent() public {
        vm.expectRevert();
        reg.agentWallet(99);
        vm.expectRevert();
        reg.tokenURI(99);
    }

    function test_supportsInterface() public view {
        assertTrue(reg.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(reg.supportsInterface(0x49064906)); // ERC-4906
        assertTrue(reg.supportsInterface(type(IAccessControl).interfaceId));
        assertFalse(reg.supportsInterface(0xdeadbeef));
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_register_uniqueWallets(address owner, address w1, address w2, bytes32 p) public {
        vm.assume(owner != address(0) && owner.code.length == 0 && w1 != address(0) && w2 != address(0) && w1 != w2);
        vm.assume(uint160(owner) > 0x100); // skip precompiles
        vm.startPrank(owner);
        uint256 a = reg.register(owner, w1, "u", p);
        uint256 b = reg.register(owner, w2, "u", p);
        vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.WalletTaken.selector, w1, a));
        reg.register(owner, w1, "u", p);
        vm.stopPrank();
        assertEq(reg.agentIdOf(w1), a);
        assertEq(reg.agentIdOf(w2), b);
        assertEq(reg.balanceOf(owner), 2);
    }

    function testFuzz_rotate_keepsIndexConsistent(address[5] calldata wallets) public {
        uint256 id = _register();
        address current = aliceAgent;
        for (uint256 i; i < wallets.length; ++i) {
            address w = wallets[i];
            if (w == address(0) || reg.agentIdOf(w) != 0) continue;
            vm.prank(alice);
            reg.setAgentWallet(id, w);
            assertEq(reg.agentIdOf(current), 0);
            current = w;
            assertEq(reg.agentWallet(id), current);
            assertEq(reg.agentIdOf(current), id);
        }
    }

    function testFuzz_memoryRoot_onlyOwnerOrAgent(address caller, bytes32 root) public {
        uint256 id = _register();
        vm.prank(caller);
        if (caller != alice && caller != aliceAgent) {
            vm.expectRevert(abi.encodeWithSelector(LexariAgentRegistry.NotOwnerOrAgent.selector, id, caller));
            reg.setMemoryRoot(id, root);
        } else {
            reg.setMemoryRoot(id, root);
            assertEq(reg.agent(id).memoryRoot, root);
        }
    }
}
