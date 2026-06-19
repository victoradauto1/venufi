// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "../VenueFi.sol";

contract VenueFiHarness is VenueFi {
    constructor(
        string memory _venueName,
        uint256 _deadline,
        uint256 _operatingDuration,
        uint256 _fundingGoal,
        address _operator,
        uint256 _operatorFeePercentage
    )
        VenueFi(
            _venueName,
            _deadline,
            _operatingDuration,
            _fundingGoal,
            _operator,
            _operatorFeePercentage
        )
    {}

    /// @dev Force state to ACTIVE without requiring investors — used to test NoInvestors branch
    function forceActive() external {
        state = State.ACTIVE;
    }

    /// @dev Artificially inflate rewardDebt to trigger the underflow guard in pending()
    function forceRewardDebt(address user, uint256 amount) external {
        rewardDebt[user] = amount;
    }

    /// @dev Force endTime far in the future to allow depositRevenue in tests
    function forceEndTime(uint256 _endTime) external {
        endTime = _endTime;
    }
}
