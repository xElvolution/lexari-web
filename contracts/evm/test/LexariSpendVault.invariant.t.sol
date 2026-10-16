// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LexariAgentRegistry} from "../src/LexariAgentRegistry.sol";
import {LexariSpendVault} from "../src/LexariSpendVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Drives the vault with random deposits, spends, withdrawals, policy changes and day changes.
contract VaultHandler is Test {
    LexariSpendVault public vault;
    LexariAgentRegistry public reg;
    MockERC20 public usdc;
    address[3] public owners;
    address[3] public wallets;
    uint256[3] public ids;
    mapping(uint256 => mapping(uint256 => uint256)) public spentOnDay; // agent index => day => spent

    constructor(LexariSpendVault v, LexariAgentRegistry r, MockERC20 t) {
        vault = v;
        reg = r;
        usdc = t;
        for (uint256 i; i < 3; ++i) {
            owners[i] = makeAddr(string.concat("owner", vm.toString(i)));
            wallets[i] = makeAddr(string.concat("wallet", vm.toString(i)));
            vm.prank(owners[i]);
            ids[i] = r.register(owners[i], wallets[i], "u", bytes32(0));
            t.mint(owners[i], 1e30);
            vm.prank(owners[i]);
            t.approve(address(v), type(uint256).max);
            vm.prank(owners[i]);
            v.setPolicy(ids[i], address(t), 50e6, 120e6, true);
        }
    }

    function deposit(uint256 who, uint256 amount) external {
        who %= 3;
        amount = bound(amount, 1, 1_000e6);
        vm.prank(owners[who]);
        vault.deposit(ids[who], address(usdc), amount);
    }

    function withdraw(uint256 who, uint256 amount) external {
        who %= 3;
        uint256 bal = vault.balanceOf(ids[who], address(usdc));
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(owners[who]);
        vault.withdraw(ids[who], address(usdc), amount, owners[who]);
    }

    function spend(uint256 who, uint256 amount) external {
        who %= 3;
        amount = bound(amount, 1, 200e6);
        vm.prank(wallets[who]);
        try vault.spend(ids[who], address(usdc), address(0xbeef), amount, bytes32(0)) {
            spentOnDay[who][block.timestamp / 1 days] += amount;
        } catch {}
    }

    function setPolicy(uint256 who, uint128 perTx, uint128 daily) external {
        who %= 3;
        perTx = uint128(bound(perTx, 1, 100e6));
        daily = uint128(bound(daily, perTx, 300e6));
        vm.prank(owners[who]);
        vault.setPolicy(ids[who], address(usdc), perTx, daily, true);
    }

    function nextDay() external {
        vm.warp(block.timestamp + 1 days);
    }

    function sumBalances() external view returns (uint256 s) {
        for (uint256 i; i < 3; ++i) s += vault.balanceOf(ids[i], address(usdc));
    }

    function spentToday(uint256 who) external view returns (uint256) {
        return spentOnDay[who][block.timestamp / 1 days];
    }
}

contract LexariSpendVaultInvariantTest is Test {
    LexariSpendVault vault;
    VaultHandler handler;
    MockERC20 usdc;

    function setUp() public {
        vm.warp(1_760_000_000);
        LexariAgentRegistry reg = new LexariAgentRegistry(address(this));
        vault = new LexariSpendVault(address(this), reg);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        handler = new VaultHandler(vault, reg, usdc);
        targetContract(address(handler));
    }

    /// The vault always holds exactly what it owes agents.
    function invariant_solvent() public view {
        assertEq(usdc.balanceOf(address(vault)), vault.totalHeld(address(usdc)));
        assertEq(vault.totalHeld(address(usdc)), handler.sumBalances());
    }

    /// The vault's own day counter always matches what the handler saw spent today, and never passes the cap
    /// allowed by any policy the handler can set (300 USDC).
    function invariant_dailySpendTracked() public view {
        for (uint256 i; i < 3; ++i) {
            LexariSpendVault.Policy memory p = vault.policyOf(handler.ids(i), address(usdc));
            uint256 tracked = p.day == block.timestamp / 1 days ? p.spentToday : 0;
            assertEq(tracked, handler.spentToday(i));
            assertLe(tracked, 300e6);
        }
    }
}
