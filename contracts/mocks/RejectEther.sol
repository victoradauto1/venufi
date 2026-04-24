// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../VenueFi.sol";

contract RejectEther {
    VenueFi public target;

    constructor(address _target) {
        target = VenueFi(_target);
    }

    function doInvest() external payable {
        target.invest{value: msg.value}();
    }

    function doRefund() external {
        target.refund();
    }

    function doClaim() external {
        target.claimRevenue();
    }

    // no receive() — rejects ETH, forcing !success in the contract
}