// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {LexariBackgrounds} from "./LexariBackgrounds.sol";

/**
 * @title Lexari agent ID card
 * @notice Each token is an agent's ID card with fully onchain metadata: the card SVG,
 * the agent's face and its background are all stored and assembled by this contract.
 * The owner can update the face or the card text; every update emits ERC-4906
 * MetadataUpdate(tokenId) so marketplaces refresh the image.
 *
 * Face data: `dna` is the compact face recipe the web app saves (shape, colour, eyes,
 * mouth, extras, brows, orbit, background); `face` is the face drawing rendered from that
 * DNA by the web app's face generator (an SVG <g> fragment in a -8 -12 116 116 box).
 */
contract LexariAgentCard is ERC721, IERC4906 {
    using Strings for uint256;

    struct Card {
        string name;
        string role;
        string dna;
        string face;
        uint8 bg;
        uint64 updatedAt;
    }

    LexariBackgrounds public immutable backgrounds;
    uint256 public nextId = 1;
    mapping(uint256 => Card) private _cards;

    event CardMinted(uint256 indexed tokenId, address indexed owner, string name);
    event FaceUpdated(uint256 indexed tokenId, string dna, uint8 bg);
    event CardUpdated(uint256 indexed tokenId, string name, string role);

    error NotTokenOwner();
    error BadText();
    error BadDna();
    error BadFace();
    error BadBackground();

    constructor(LexariBackgrounds bgs) ERC721("Lexari Agent ID", "LXID") {
        backgrounds = bgs;
    }

    // ------------------------------------------------------------------ writes

    function mint(string calldata name_, string calldata role, string calldata dna, string calldata face, uint8 bg) external returns (uint256 id) {
        _checkCard(name_, role);
        _checkFace(dna, face, bg);
        id = nextId++;
        _cards[id] = Card(name_, role, dna, face, bg, uint64(block.timestamp));
        // Plain _mint: the caller mints to itself, and EIP-7702 / smart-account wallets
        // often lack onERC721Received, which would make _safeMint revert.
        _mint(msg.sender, id);
        emit CardMinted(id, msg.sender, name_);
    }

    function updateFace(uint256 id, string calldata dna, string calldata face, uint8 bg) external {
        _onlyOwner(id);
        _checkFace(dna, face, bg);
        Card storage c = _cards[id];
        c.dna = dna;
        c.face = face;
        c.bg = bg;
        c.updatedAt = uint64(block.timestamp);
        emit FaceUpdated(id, dna, bg);
        emit MetadataUpdate(id);
    }

    function updateCard(uint256 id, string calldata name_, string calldata role) external {
        _onlyOwner(id);
        _checkCard(name_, role);
        Card storage c = _cards[id];
        c.name = name_;
        c.role = role;
        c.updatedAt = uint64(block.timestamp);
        emit CardUpdated(id, name_, role);
        emit MetadataUpdate(id);
    }

    // ------------------------------------------------------------------- reads

    function card(uint256 id) external view returns (Card memory) {
        _requireOwned(id);
        return _cards[id];
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Card storage c = _cards[id];
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(cardSvg(id))));
        string memory json = string.concat(
            '{"name":"', c.name, ' \\u00b7 Lexari Agent ID #', id.toString(),
            '","description":"An agent ID card from Lexari. Fully onchain: the card, face and background are stored and drawn by the contract. Updates emit ERC-4906 MetadataUpdate.",',
            '"image":"', image, '","attributes":[',
            '{"trait_type":"Role","value":"', c.role, '"},',
            '{"trait_type":"Background","value":"', backgrounds.name(c.bg), '"},',
            '{"trait_type":"Face DNA","value":"', c.dna, '"},',
            '{"display_type":"date","trait_type":"Updated","value":', uint256(c.updatedAt).toString(), "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @notice The ID card image (340 x 480), same layout as the web app's ID card.
    function cardSvg(uint256 id) public view returns (string memory) {
        _requireOwned(id);
        Card storage c = _cards[id];
        string memory uid = string.concat("c", id.toString());
        string memory idNo = string.concat("LX-", _pad(id));
        string memory head = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 480" width="340" height="480" font-family="Helvetica,Arial,sans-serif">',
            '<defs><clipPath id="', uid, 'w"><rect x="18" y="104" width="304" height="196" rx="18"/></clipPath></defs>',
            '<rect width="340" height="480" rx="28" fill="#5b2bff"/>',
            '<rect x="6" y="6" width="328" height="468" rx="24" fill="#ffffff"/>',
            '<rect x="146" y="16" width="48" height="7" rx="3.5" fill="#000" fill-opacity=".1"/>',
            '<rect x="18" y="32" width="304" height="62" rx="16" fill="#5b2bff"/>',
            '<text x="170" y="66" text-anchor="middle" font-size="28" font-weight="900" fill="#fff">HELLO</text>',
            '<text x="170" y="84" text-anchor="middle" font-size="10" letter-spacing="2" fill="#fff" fill-opacity=".8">MY NAME IS</text>'
        );
        string memory window = string.concat(
            '<g clip-path="url(#', uid, 'w)"><rect x="18" y="104" width="304" height="196" fill="#0a0a0a"/>',
            '<svg x="18" y="104" width="304" height="196" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">', backgrounds.svg(c.bg, uid), "</svg>",
            '<svg x="100" y="132" width="140" height="140" viewBox="-8 -12 116 116" overflow="visible">', c.face, "</svg></g>",
            '<text x="32" y="124" font-size="9" letter-spacing="1.5" fill="#fff" fill-opacity=".75">LEXARI</text>',
            '<rect x="250" y="113" width="60" height="16" rx="8" fill="#5b2bff"/><text x="280" y="124.5" text-anchor="middle" font-size="8.5" fill="#fff">ONCHAIN</text>',
            '<text x="32" y="292" font-size="8" letter-spacing="1" fill="#fff" fill-opacity=".6">', idNo, "</text>"
        );
        string memory foot = string.concat(
            '<text x="24" y="352" font-size="40" font-weight="900" fill="#0a0a0a">', c.name, "</text>",
            '<text x="24" y="376" font-size="10" letter-spacing="1.5" fill="#000" fill-opacity=".6">', _upper(c.role), unicode" · AGENT ID #", id.toString(), "</text>",
            _barcode(c.name, id),
            '<text x="316" y="458" text-anchor="end" font-size="8" letter-spacing="1" fill="#000" fill-opacity=".45">LXID ', idNo, "</text></svg>"
        );
        return string.concat(head, window, foot);
    }

    function supportsInterface(bytes4 iid) public view override(ERC721, IERC165) returns (bool) {
        return iid == bytes4(0x49064906) || super.supportsInterface(iid);
    }

    // ---------------------------------------------------------------- internals

    function _onlyOwner(uint256 id) private view {
        if (_requireOwned(id) != msg.sender) revert NotTokenOwner();
    }

    /// names: 1-16 chars, roles: 0-28 chars, letters / digits / space . _ - only (safe in JSON and SVG)
    function _checkCard(string calldata name_, string calldata role) private pure {
        bytes calldata n = bytes(name_);
        bytes calldata r = bytes(role);
        if (n.length == 0 || n.length > 16 || r.length > 28) revert BadText();
        for (uint256 i; i < n.length; i++) if (!_safe(n[i], true)) revert BadText();
        for (uint256 i; i < r.length; i++) if (!_safe(r[i], true)) revert BadText();
    }

    function _checkFace(string calldata dna, string calldata face, uint8 bg) private view {
        if (bg >= backgrounds.COUNT()) revert BadBackground();
        bytes calldata d = bytes(dna);
        if (d.length == 0 || d.length > 240) revert BadDna();
        for (uint256 i; i < d.length; i++) {
            bytes1 ch = d[i];
            if (!(_safe(ch, false) || ch == "=" || ch == ";" || ch == ",")) revert BadDna();
        }
        bytes calldata f = bytes(face);
        if (f.length < 8 || f.length > 16000 || f[0] != "<") revert BadFace();
        // no scripts, foreign content or external references inside the face drawing
        if (_has(f, "<script") || _has(f, "<foreign") || _has(f, "href") || _has(f, "<!") || _has(f, "</svg")) revert BadFace();
    }

    function _safe(bytes1 ch, bool space) private pure returns (bool) {
        return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch == "." || ch == "_" || ch == "-" || (space && ch == " ");
    }

    function _has(bytes calldata hay, bytes memory needle) private pure returns (bool) {
        if (hay.length < needle.length) return false;
        for (uint256 i; i <= hay.length - needle.length; i++) {
            bool ok = true;
            for (uint256 j; j < needle.length; j++) {
                bytes1 a = hay[i + j];
                if (a >= "A" && a <= "Z") a = bytes1(uint8(a) + 32);
                if (a != needle[j]) { ok = false; break; }
            }
            if (ok) return true;
        }
        return false;
    }

    function _upper(string memory s) private pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; i++) if (b[i] >= "a" && b[i] <= "z") b[i] = bytes1(uint8(b[i]) - 32);
        return string(b);
    }

    function _pad(uint256 id) private pure returns (string memory) {
        string memory s = id.toString();
        while (bytes(s).length < 5) s = string.concat("0", s);
        return s;
    }

    function _barcode(string memory name_, uint256 id) private pure returns (string memory out) {
        bytes memory n = bytes(string.concat(name_, id.toString(), "lexari"));
        uint256 x = 24;
        out = '<g fill="#0a0a0a">';
        for (uint256 i; i < 22 && x < 314; i++) {
            uint256 c = uint8(n[i % n.length]) + i * 7;
            uint256 w = 1 + (c % 4);
            out = string.concat(out, '<rect x="', x.toString(), '" y="396" width="', w.toString(), '" height="40"/>');
            x += w + 2 + ((c >> 2) % 5);
        }
        out = string.concat(out, "</g>");
    }
}
