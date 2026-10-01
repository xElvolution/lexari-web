// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LexariAgentCard} from "../src/LexariAgentCard.sol";
import {LexariBackgrounds} from "../src/LexariBackgrounds.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract LexariAgentCardTest is Test {
    LexariAgentCard nft;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    string constant DNA = "shape=robot;color=teal;eyes=oval;mouth=smile;extra=antenna;brows=soft;orbit=dots;dots=3;bg=aurora;blush=0";
    string constant FACE = '<g><rect x="14" y="20" width="72" height="68" rx="10" fill="#2dd4bf"/><ellipse cx="38" cy="52" rx="6.5" ry="8.5" fill="#0a0a0a"/></g>';
    event MetadataUpdate(uint256 _tokenId);

    function setUp() public {
        nft = new LexariAgentCard(new LexariBackgrounds());
    }

    function _mint() internal returns (uint256) {
        vm.prank(alice);
        return nft.mint("Juniper", "Personal agent", DNA, FACE, 7);
    }

    function test_mint() public {
        uint256 id = _mint();
        assertEq(id, 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.card(1).name, "Juniper");
        assertEq(nft.card(1).bg, 7);
        assertEq(nft.nextId(), 2);
    }

    function test_supportsERC4906() public view {
        assertTrue(nft.supportsInterface(0x49064906));
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC-721
    }

    function test_updateFace_emitsMetadataUpdate() public {
        uint256 id = _mint();
        string memory face2 = '<g><circle cx="50" cy="54" r="38" fill="#ff8a3d"/></g>';
        vm.expectEmit(true, false, false, true, address(nft));
        emit MetadataUpdate(id);
        vm.prank(alice);
        nft.updateFace(id, "shape=round;color=orange;bg=sunset", face2, 3);
        assertEq(nft.card(id).face, face2);
        assertEq(nft.card(id).bg, 3);
    }

    function test_updateCard_emitsMetadataUpdate() public {
        uint256 id = _mint();
        vm.expectEmit(true, false, false, true, address(nft));
        emit MetadataUpdate(id);
        vm.prank(alice);
        nft.updateCard(id, "Nova", "Research");
        assertEq(nft.card(id).name, "Nova");
        assertEq(nft.card(id).role, "Research");
    }

    function test_revert_nonOwnerUpdates() public {
        uint256 id = _mint();
        vm.startPrank(bob);
        vm.expectRevert(LexariAgentCard.NotTokenOwner.selector);
        nft.updateFace(id, DNA, FACE, 1);
        vm.expectRevert(LexariAgentCard.NotTokenOwner.selector);
        nft.updateCard(id, "Mallory", "x");
        vm.stopPrank();
    }

    function test_newOwnerCanUpdateAfterTransfer() public {
        uint256 id = _mint();
        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        vm.prank(bob);
        nft.updateCard(id, "Bobby", "Ops");
        vm.prank(alice);
        vm.expectRevert(LexariAgentCard.NotTokenOwner.selector);
        nft.updateCard(id, "Back", "x");
    }

    function test_revert_unknownToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 9));
        nft.tokenURI(9);
    }

    function test_revert_badInputs() public {
        vm.startPrank(alice);
        vm.expectRevert(LexariAgentCard.BadText.selector);
        nft.mint('Bad"name', "x", DNA, FACE, 0);
        vm.expectRevert(LexariAgentCard.BadText.selector);
        nft.mint("", "x", DNA, FACE, 0);
        vm.expectRevert(LexariAgentCard.BadDna.selector);
        nft.mint("Ok", "x", 'a"b', FACE, 0);
        vm.expectRevert(LexariAgentCard.BadFace.selector);
        nft.mint("Ok", "x", DNA, '<g><script>alert(1)</script></g>', 0);
        vm.expectRevert(LexariAgentCard.BadFace.selector);
        nft.mint("Ok", "x", DNA, '<g><image href="https://x.y/a.png"/></g>', 0);
        vm.expectRevert(LexariAgentCard.BadBackground.selector);
        nft.mint("Ok", "x", DNA, FACE, 200);
        vm.stopPrank();
    }

    function test_tokenURI_isValidJsonWithSvg() public {
        uint256 id = _mint();
        string memory uri = nft.tokenURI(id);
        string memory prefix = "data:application/json;base64,";
        assertTrue(_startsWith(uri, prefix));
        string memory json = string(_b64decode(_slice(bytes(uri), bytes(prefix).length)));
        // vm.parseJson* revert on malformed JSON, so these also prove the JSON is valid
        assertEq(vm.parseJsonString(json, ".name"), unicode"Juniper · Lexari Agent ID #1");
        assertEq(vm.parseJsonString(json, ".attributes[0].value"), "Personal agent");
        assertEq(vm.parseJsonString(json, ".attributes[1].value"), "Aurora");
        assertEq(vm.parseJsonString(json, ".attributes[2].value"), DNA);
        string memory image = vm.parseJsonString(json, ".image");
        string memory ip = "data:image/svg+xml;base64,";
        assertTrue(_startsWith(image, ip));
        string memory svg = string(_b64decode(_slice(bytes(image), bytes(ip).length)));
        assertTrue(_startsWith(svg, '<svg xmlns="http://www.w3.org/2000/svg"'));
        assertTrue(_endsWith(svg, "</svg>"));
        assertTrue(_contains(svg, FACE));
        assertTrue(_contains(svg, ">Juniper<"));
        assertEq(svg, nft.cardSvg(id));
        vm.writeFile("out/sample-card.svg", svg);
        vm.writeFile("out/sample-token.json", json);
    }

    function test_everyBackgroundRenders() public view {
        LexariBackgrounds b = nft.backgrounds();
        for (uint8 i; i < b.COUNT(); i++) {
            string memory s = b.svg(i, "u");
            assertTrue(bytes(s).length > 20);
            assertTrue(_startsWith(s, "<"));
        }
    }

    // ---------------------------------------------------------------- helpers
    function _startsWith(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s); bytes memory b = bytes(p);
        if (a.length < b.length) return false;
        for (uint256 i; i < b.length; i++) if (a[i] != b[i]) return false;
        return true;
    }
    function _endsWith(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s); bytes memory b = bytes(p);
        if (a.length < b.length) return false;
        for (uint256 i; i < b.length; i++) if (a[a.length - b.length + i] != b[i]) return false;
        return true;
    }
    function _contains(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s); bytes memory b = bytes(p);
        if (a.length < b.length) return false;
        for (uint256 i; i <= a.length - b.length; i++) {
            bool ok = true;
            for (uint256 j; j < b.length; j++) if (a[i + j] != b[j]) { ok = false; break; }
            if (ok) return true;
        }
        return false;
    }
    function _slice(bytes memory a, uint256 from) internal pure returns (bytes memory r) {
        r = new bytes(a.length - from);
        for (uint256 i; i < r.length; i++) r[i] = a[from + i];
    }
    function _b64val(bytes1 c) internal pure returns (uint8) {
        if (c >= "A" && c <= "Z") return uint8(c) - 65;
        if (c >= "a" && c <= "z") return uint8(c) - 71;
        if (c >= "0" && c <= "9") return uint8(c) + 4;
        if (c == "+") return 62;
        if (c == "/") return 63;
        return 0;
    }
    function _b64decode(bytes memory s) internal pure returns (bytes memory out) {
        uint256 pad = s.length > 1 && s[s.length - 1] == "=" ? (s[s.length - 2] == "=" ? 2 : 1) : 0;
        out = new bytes((s.length / 4) * 3 - pad);
        uint256 k;
        for (uint256 i; i < s.length; i += 4) {
            uint256 n = (uint256(_b64val(s[i])) << 18) | (uint256(_b64val(s[i + 1])) << 12) | (uint256(_b64val(s[i + 2])) << 6) | uint256(_b64val(s[i + 3]));
            if (k < out.length) out[k++] = bytes1(uint8(n >> 16));
            if (k < out.length) out[k++] = bytes1(uint8(n >> 8));
            if (k < out.length) out[k++] = bytes1(uint8(n));
        }
    }

    function test_contractWalletCanMint() public {
        // A wallet with code but no onERC721Received (like an EIP-7702 account) must still mint.
        NoReceiver w = new NoReceiver();
        vm.prank(address(w));
        uint256 id = nft.mint("Smart", "Wallet agent", DNA, FACE, 2);
        assertEq(nft.ownerOf(id), address(w));
    }
}

contract NoReceiver {}
