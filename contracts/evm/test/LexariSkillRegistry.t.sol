// SPDX-License-Identifier: LicenseRef-Lexari-Proprietary
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LexariAgentRegistry} from "../src/LexariAgentRegistry.sol";
import {LexariSkillRegistry} from "../src/LexariSkillRegistry.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MockERC20, RejectsNative} from "./mocks/MockERC20.sol";

contract LexariSkillRegistryTest is Test {
    LexariAgentRegistry reg;
    LexariSkillRegistry skills;
    MockERC20 usdc;
    address admin = makeAddr("admin");
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address co = makeAddr("coCreator");
    address alice = makeAddr("alice");
    address agentW = makeAddr("agentW");
    address bob = makeAddr("bob");
    uint256 agentId;
    address constant NATIVE = address(0);
    address[] noPayees;
    uint16[] noBps;

    function setUp() public {
        reg = new LexariAgentRegistry(admin);
        skills = new LexariSkillRegistry(admin, reg, treasury, 1_000); // 10%
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vm.startPrank(admin);
        skills.setPaymentToken(address(usdc), true);
        skills.setPaymentToken(NATIVE, true);
        vm.stopPrank();
        vm.prank(alice);
        agentId = reg.register(alice, agentW, "u", bytes32(0));
        usdc.mint(alice, 1_000e6);
        usdc.mint(agentW, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(skills), type(uint256).max);
        vm.prank(agentW);
        usdc.approve(address(skills), type(uint256).max);
    }

    function _publish(uint128 price) internal returns (uint256) {
        vm.prank(creator);
        return skills.publish("ipfs://skill", keccak256("v1"), address(usdc), price, noPayees, noBps);
    }

    function test_constructor_guards() public {
        vm.expectRevert(LexariSkillRegistry.ZeroAddress.selector);
        new LexariSkillRegistry(admin, reg, address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.FeeTooHigh.selector, 3_001));
        new LexariSkillRegistry(admin, reg, treasury, 3_001);
    }

    function test_publish_and_install_feeSplit() public {
        uint256 sid = _publish(10e6);
        assertEq(sid, 1);
        vm.expectEmit(true, true, true, true);
        emit LexariSkillRegistry.SkillInstalled(sid, agentId, alice, 1, 10e6, 1e6);
        vm.prank(alice);
        skills.install(sid, agentId);
        assertEq(skills.installedVersion(agentId, sid), 1);
        assertEq(skills.claimable(treasury, address(usdc)), 1e6);
        assertEq(skills.claimable(creator, address(usdc)), 9e6);
        vm.prank(creator);
        skills.claim(address(usdc));
        assertEq(usdc.balanceOf(creator), 9e6);
        vm.prank(creator);
        vm.expectRevert(LexariSkillRegistry.NothingToClaim.selector);
        skills.claim(address(usdc));
    }

    function test_agentWalletCanInstall_strangerCannot() public {
        uint256 sid = _publish(1e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.NotOwnerOrAgent.selector, agentId, bob));
        skills.install(sid, agentId);
        vm.prank(agentW);
        skills.install(sid, agentId);
        assertEq(usdc.balanceOf(agentW), 999e6);
    }

    function test_splits() public {
        address[] memory p = new address[](2);
        uint16[] memory b = new uint16[](2);
        (p[0], p[1], b[0], b[1]) = (creator, co, 7_000, 3_000);
        vm.prank(creator);
        uint256 sid = skills.publish("u", bytes32(0), address(usdc), 100e6, p, b);
        vm.prank(alice);
        skills.install(sid, agentId);
        assertEq(skills.claimable(treasury, address(usdc)), 10e6);
        assertEq(skills.claimable(creator, address(usdc)), 63e6);
        assertEq(skills.claimable(co, address(usdc)), 27e6);
        assertEq(skills.splitOf(sid).length, 2);
    }

    function test_badSplits() public {
        address[] memory p = new address[](2);
        uint16[] memory b = new uint16[](2);
        (p[0], p[1], b[0], b[1]) = (creator, co, 7_000, 2_000);
        vm.startPrank(creator);
        vm.expectRevert(LexariSkillRegistry.BadSplit.selector);
        skills.publish("u", bytes32(0), address(usdc), 1, p, b);
        (b[1]) = 3_000;
        p[1] = address(0);
        vm.expectRevert(LexariSkillRegistry.BadSplit.selector);
        skills.publish("u", bytes32(0), address(usdc), 1, p, b);
        uint16[] memory one = new uint16[](1);
        vm.expectRevert(LexariSkillRegistry.BadSplit.selector);
        skills.publish("u", bytes32(0), address(usdc), 1, p, one);
        address[] memory nine = new address[](9);
        uint16[] memory nineB = new uint16[](9);
        vm.expectRevert(LexariSkillRegistry.BadSplit.selector);
        skills.publish("u", bytes32(0), address(usdc), 1, nine, nineB);
        vm.stopPrank();
    }

    function test_versions_reinstall() public {
        uint256 sid = _publish(1e6);
        vm.startPrank(alice);
        skills.install(sid, agentId);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.AlreadyInstalled.selector, agentId, sid, 1));
        skills.install(sid, agentId);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.NotCreator.selector, sid, bob));
        skills.publishVersion(sid, "u2", keccak256("v2"));
        vm.prank(creator);
        skills.publishVersion(sid, "u2", keccak256("v2"));
        assertEq(skills.skill(sid).version, 2);
        vm.prank(alice);
        skills.install(sid, agentId);
        assertEq(skills.installedVersion(agentId, sid), 2);
    }

    function test_native_price() public {
        vm.prank(creator);
        uint256 sid = skills.publish("u", bytes32(0), NATIVE, 1 ether, noPayees, noBps);
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.WrongNativeValue.selector, 0.5 ether, 1 ether));
        skills.install{value: 0.5 ether}(sid, agentId);
        vm.prank(alice);
        skills.install{value: 1 ether}(sid, agentId);
        vm.prank(creator);
        skills.claim(NATIVE);
        assertEq(creator.balance, 0.9 ether);
    }

    function test_native_sentWithTokenPriceReverts() public {
        uint256 sid = _publish(1e6);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.WrongNativeValue.selector, 1, 0));
        skills.install{value: 1}(sid, agentId);
    }

    function test_payeeThatRejectsNative_doesNotBlockInstalls() public {
        RejectsNative r = new RejectsNative();
        address[] memory p = new address[](1);
        uint16[] memory b = new uint16[](1);
        (p[0], b[0]) = (address(r), 10_000);
        vm.prank(creator);
        uint256 sid = skills.publish("u", bytes32(0), NATIVE, 1 ether, p, b);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        skills.install{value: 1 ether}(sid, agentId);
        vm.prank(address(r));
        vm.expectRevert(LexariSkillRegistry.NativeTransferFailed.selector);
        skills.claim(NATIVE);
        assertEq(skills.claimable(address(r), NATIVE), 0.9 ether); // still owed
    }

    function test_free_skill() public {
        uint256 sid = _publish(0);
        vm.prank(alice);
        skills.install(sid, agentId);
        assertEq(skills.claimable(creator, address(usdc)), 0);
    }

    function test_unavailable() public {
        uint256 sid = _publish(1);
        vm.prank(creator);
        skills.setActive(sid, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.SkillUnavailable.selector, sid));
        skills.install(sid, agentId);
        vm.prank(creator);
        skills.setActive(sid, true);
        vm.prank(admin);
        skills.setDelisted(sid, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.SkillUnavailable.selector, sid));
        skills.install(sid, agentId);
        vm.prank(creator);
        vm.expectRevert();
        skills.setDelisted(sid, false); // curators only
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.UnknownSkill.selector, 99));
        skills.install(99, agentId);
    }

    function test_tokenAllowlist_and_price() public {
        MockERC20 other = new MockERC20("X", "X", 18);
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.TokenNotAllowed.selector, address(other)));
        skills.publish("u", bytes32(0), address(other), 1, noPayees, noBps);
        uint256 sid = skills.publish("u", bytes32(0), address(usdc), 1, noPayees, noBps);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.TokenNotAllowed.selector, address(other)));
        skills.setPrice(sid, address(other), 5);
        skills.setPrice(sid, address(usdc), 5);
        vm.stopPrank();
        assertEq(skills.skill(sid).price, 5);
    }

    function test_admin() public {
        vm.prank(bob);
        vm.expectRevert();
        skills.setProtocolFee(0);
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.FeeTooHigh.selector, 5_000));
        skills.setProtocolFee(5_000);
        skills.setProtocolFee(500);
        skills.setTreasury(bob);
        vm.expectRevert(LexariSkillRegistry.ZeroAddress.selector);
        skills.setTreasury(address(0));
        vm.stopPrank();
        uint256 sid = _publish(100e6);
        vm.prank(alice);
        skills.install(sid, agentId);
        assertEq(skills.claimable(bob, address(usdc)), 5e6);
    }

    function test_pause_keepsClaims() public {
        uint256 sid = _publish(10e6);
        vm.prank(alice);
        skills.install(sid, agentId);
        vm.prank(admin);
        skills.pause();
        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        skills.publish("u", bytes32(0), address(usdc), 1, noPayees, noBps);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        skills.install(sid, agentId);
        vm.prank(creator);
        skills.claim(address(usdc));
        assertEq(usdc.balanceOf(creator), 9e6);
    }

    // ------------------------------------------------------------------ fuzz

    /// Every unit paid ends up claimable by exactly someone: fee plus every payee's share equals the price.
    function testFuzz_splitConservesValue(uint128 price, uint16 fee, uint16[4] calldata raw) public {
        price = uint128(bound(price, 0, 1e30));
        fee = uint16(bound(fee, 0, 3_000));
        vm.prank(admin);
        skills.setProtocolFee(fee);
        // build a valid 4-way split from raw weights
        address[] memory p = new address[](4);
        uint16[] memory b = new uint16[](4);
        uint256 total;
        for (uint256 i; i < 4; ++i) total += uint256(raw[i]) + 1;
        uint256 used;
        for (uint256 i; i < 4; ++i) {
            p[i] = address(uint160(0x1000 + i));
            b[i] = i == 3 ? uint16(10_000 - used) : uint16((uint256(raw[i]) + 1) * 9_996 / total + 1);
            used += b[i];
        }
        usdc.mint(alice, price);
        vm.prank(creator);
        uint256 sid = skills.publish("u", bytes32(0), address(usdc), price, p, b);
        vm.prank(alice);
        skills.install(sid, agentId);
        uint256 sum = skills.claimable(treasury, address(usdc));
        for (uint256 i; i < 4; ++i) sum += skills.claimable(p[i], address(usdc));
        assertEq(sum, price);
        assertEq(usdc.balanceOf(address(skills)), price);
        assertEq(skills.claimable(treasury, address(usdc)), uint256(price) * fee / 10_000);
    }

    function testFuzz_onlyOwnerOrAgentInstalls(address caller) public {
        vm.assume(caller != alice && caller != agentW);
        uint256 sid = _publish(0);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.NotOwnerOrAgent.selector, agentId, caller));
        skills.install(sid, agentId);
    }

    function testFuzz_feeCap(uint16 bps) public {
        vm.prank(admin);
        if (bps > 3_000) {
            vm.expectRevert(abi.encodeWithSelector(LexariSkillRegistry.FeeTooHigh.selector, bps));
            skills.setProtocolFee(bps);
        } else {
            skills.setProtocolFee(bps);
            assertEq(skills.protocolFeeBps(), bps);
        }
    }
}
