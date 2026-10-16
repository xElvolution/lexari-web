// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LexariAgentRegistry} from "../src/LexariAgentRegistry.sol";
import {LexariSpendVault} from "../src/LexariSpendVault.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MockERC20, FeeOnTransferERC20, RejectsNative} from "./mocks/MockERC20.sol";

contract LexariSpendVaultTest is Test {
    LexariAgentRegistry reg;
    LexariSpendVault vault;
    MockERC20 usdc;
    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address agentW = makeAddr("agentWallet");
    address shop = makeAddr("shop");
    address bob = makeAddr("bob");
    uint256 id;
    address constant NATIVE = address(0);

    function setUp() public {
        vm.warp(1_760_000_000);
        reg = new LexariAgentRegistry(admin);
        vault = new LexariSpendVault(admin, reg);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vm.prank(alice);
        id = reg.register(alice, agentW, "ipfs://a", bytes32(0));
        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.deal(alice, 100 ether);
    }

    function _fund(uint256 amount) internal {
        vm.prank(alice);
        vault.deposit(id, address(usdc), amount);
    }

    function _policy(uint128 perTx, uint128 daily) internal {
        vm.prank(alice);
        vault.setPolicy(id, address(usdc), perTx, daily, true);
    }

    function _spend(uint256 amount) internal {
        vm.prank(agentW);
        vault.spend(id, address(usdc), shop, amount, bytes32("card"));
    }

    function test_constructor_rejectsZero() public {
        vm.expectRevert(LexariSpendVault.ZeroAddress.selector);
        new LexariSpendVault(address(0), reg);
        vm.expectRevert(LexariSpendVault.ZeroAddress.selector);
        new LexariSpendVault(admin, LexariAgentRegistry(address(0)));
    }

    function test_deposit_and_withdraw() public {
        _fund(100e6);
        assertEq(vault.balanceOf(id, address(usdc)), 100e6);
        assertEq(vault.totalHeld(address(usdc)), 100e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NotAgentOwner.selector, id, bob));
        vault.withdraw(id, address(usdc), 1, bob);
        vm.prank(alice);
        vault.withdraw(id, address(usdc), 40e6, alice);
        assertEq(vault.balanceOf(id, address(usdc)), 60e6);
        assertEq(usdc.balanceOf(alice), 940e6);
    }

    function test_deposit_unknownAgentReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(42, address(usdc), 1e6);
    }

    function test_native_flow() public {
        vm.prank(alice);
        vault.depositNative{value: 1 ether}(id);
        vm.prank(alice);
        vault.setPolicy(id, NATIVE, 0.1 ether, 0.25 ether, true);
        vm.prank(agentW);
        vault.spend(id, NATIVE, shop, 0.1 ether, bytes32(0));
        assertEq(shop.balance, 0.1 ether);
        vm.prank(alice);
        (bool ok,) = address(vault).call{value: 1}("");
        assertFalse(ok); // plain sends are refused
    }

    function test_spend_withinLimits() public {
        _fund(100e6);
        _policy(10e6, 25e6);
        vm.expectEmit(true, true, true, true);
        emit LexariSpendVault.Spent(id, address(usdc), shop, 10e6, bytes32("card"), 10e6);
        _spend(10e6);
        _spend(10e6);
        assertEq(vault.spendableNow(id, address(usdc)), 5e6);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.OverDailyLimit.selector, 30e6, 25e6));
        vault.spend(id, address(usdc), shop, 10e6, bytes32(0));
        _spend(5e6);
        assertEq(usdc.balanceOf(shop), 25e6);
        // next UTC day resets
        vm.warp(block.timestamp + 1 days);
        assertEq(vault.spendableNow(id, address(usdc)), 10e6);
        _spend(10e6);
    }

    function test_spend_rejections() public {
        _fund(100e6);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NoPolicy.selector, id, address(usdc)));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));

        _policy(10e6, 20e6);
        vm.prank(alice); // owner is not the agent
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NotAgentWallet.selector, id, alice));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));

        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.OverPerTxLimit.selector, 11e6, 10e6));
        vault.spend(id, address(usdc), shop, 11e6, bytes32(0));

        vm.prank(alice);
        vault.setFrozen(id, true);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.AgentFrozen.selector, id));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
        vm.prank(alice);
        vault.setFrozen(id, false);

        vm.prank(alice);
        vault.setAllowlistOnly(id, true);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.RecipientNotAllowed.selector, shop));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
        vm.prank(alice);
        vault.setRecipient(id, shop, true);
        _spend(1);
    }

    function test_spend_insufficientBalance() public {
        _fund(5e6);
        _policy(10e6, 20e6);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.InsufficientBalance.selector, 5e6, 6e6));
        vault.spend(id, address(usdc), shop, 6e6, bytes32(0));
    }

    function test_badPolicy() public {
        vm.startPrank(alice);
        vm.expectRevert(LexariSpendVault.BadPolicy.selector);
        vault.setPolicy(id, address(usdc), 0, 10, true);
        vm.expectRevert(LexariSpendVault.BadPolicy.selector);
        vault.setPolicy(id, address(usdc), 10, 9, true);
        vault.setPolicy(id, address(usdc), 0, 0, false); // disabling is always fine
        vm.stopPrank();
    }

    function test_pause_keepsWithdrawals() public {
        _fund(50e6);
        _policy(10e6, 20e6);
        vm.prank(admin);
        vault.pause();
        vm.prank(agentW);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(id, address(usdc), 1);
        assertEq(vault.spendableNow(id, address(usdc)), 0);
        vm.prank(alice);
        vault.withdraw(id, address(usdc), 50e6, alice);
        assertEq(vault.balanceOf(id, address(usdc)), 0);
    }

    function test_walletRotation_movesSpendRight() public {
        _fund(50e6);
        _policy(10e6, 20e6);
        address next = makeAddr("next");
        vm.prank(alice);
        reg.setAgentWallet(id, next);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NotAgentWallet.selector, id, agentW));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
        vm.prank(next);
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
    }

    function test_retiredAgent_ownerCanStillWithdraw() public {
        _fund(50e6);
        _policy(10e6, 20e6);
        vm.prank(alice);
        reg.retire(id);
        vm.prank(agentW);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NotAgentWallet.selector, id, agentW));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
        vm.prank(alice);
        vault.withdraw(id, address(usdc), 50e6, alice);
    }

    function test_feeOnTransfer_creditsReceived() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20();
        fot.mint(alice, 1000);
        vm.startPrank(alice);
        fot.approve(address(vault), 1000);
        vault.deposit(id, address(fot), 1000);
        vm.stopPrank();
        assertEq(vault.balanceOf(id, address(fot)), 990);
        assertEq(fot.balanceOf(address(vault)), 990);
    }

    function test_nativeSendFailureReverts() public {
        RejectsNative r = new RejectsNative();
        vm.prank(alice);
        vault.depositNative{value: 1 ether}(id);
        vm.prank(alice);
        vm.expectRevert(LexariSpendVault.NativeTransferFailed.selector);
        vault.withdraw(id, NATIVE, 1 ether, address(r));
    }

    // ------------------------------------------------------------------ fuzz

    /// Whatever sequence of spends the agent tries, one UTC day never exceeds the daily limit and no single spend
    /// exceeds the per-transaction limit.
    function testFuzz_neverExceedsLimits(uint128 perTx, uint128 daily, uint256[8] calldata tries, uint8 dayJumps)
        public
    {
        perTx = uint128(bound(perTx, 1, 100e6));
        daily = uint128(bound(daily, perTx, 500e6));
        _fund(1_000e6);
        _policy(perTx, daily);
        uint256 spentDay;
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i < tries.length; ++i) {
            if ((dayJumps >> i) & 1 == 1) vm.warp(block.timestamp + 1 days);
            if (block.timestamp / 1 days != day) {
                day = block.timestamp / 1 days;
                spentDay = 0;
            }
            uint256 amt = bound(tries[i], 1, 200e6);
            vm.prank(agentW);
            try vault.spend(id, address(usdc), shop, amt, bytes32(0)) {
                spentDay += amt;
                assertLe(amt, perTx);
            } catch {}
            assertLe(spentDay, daily);
        }
        assertEq(usdc.balanceOf(address(vault)), vault.totalHeld(address(usdc)));
    }

    function testFuzz_onlyAgentWalletSpends(address caller) public {
        vm.assume(caller != agentW);
        _fund(10e6);
        _policy(10e6, 10e6);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(LexariSpendVault.NotAgentWallet.selector, id, caller));
        vault.spend(id, address(usdc), shop, 1, bytes32(0));
    }

    function testFuzz_depositWithdrawRoundTrip(uint256 dep, uint256 wd) public {
        dep = bound(dep, 1, 1_000e6);
        wd = bound(wd, 1, dep);
        _fund(dep);
        vm.prank(alice);
        vault.withdraw(id, address(usdc), wd, alice);
        assertEq(vault.balanceOf(id, address(usdc)), dep - wd);
        assertEq(usdc.balanceOf(alice), 1_000e6 - dep + wd);
    }
}
