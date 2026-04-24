// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../VenueFi.sol";

contract VenueFiHarness is VenueFi {
    constructor(uint256 _deadline, uint256 _fundingGoal)
        VenueFi(_deadline, _fundingGoal) {}

    /// @dev Force state to ACTIVE without requiring investors — used to test NoInvestors branch
    function forceActive() external {
        state = State.ACTIVE;
    }

    /// @dev Artificially inflate rewardDebt to trigger the underflow guard in pending()
    function forceRewardDebt(address user, uint256 amount) external {
        rewardDebt[user] = amount;
    }
}