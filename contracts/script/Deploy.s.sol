// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LexariAgentCard} from "../src/LexariAgentCard.sol";
import {LexariBackgrounds} from "../src/LexariBackgrounds.sol";

/// forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --private-key $DEPLOYER_KEY
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        LexariBackgrounds bgs = new LexariBackgrounds();
        LexariAgentCard card = new LexariAgentCard(bgs);
        vm.stopBroadcast();
        console.log("LexariBackgrounds", address(bgs));
        console.log("LexariAgentCard", address(card));
    }
}
