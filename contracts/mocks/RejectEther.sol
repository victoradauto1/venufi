// RejectEther.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../VenueFi.sol";

contract RejectEther {
    VenueFi public target;
    uint256 public investedAmount;

    constructor(address _target) {
        target = VenueFi(_target);
    }

    function doInvest() external payable {
        target.invest{value: msg.value}();
        investedAmount = msg.value;
    }

    function doRefund() external {
        target.refund(investedAmount);
    }

    // sem receive() — rejeita ETH, forçando o !success no contrato
}