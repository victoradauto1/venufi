// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VenueFi} from "./VenueFi.sol";

contract VenueFactory {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    address[] public venues;
    mapping(address => address[]) public venuesByOperator;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event VenueCreated(
        address indexed venue,
        address indexed operator,
        uint256 fundingGoal,
        uint256 fundingDuration
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidFundingGoal();
    error InvalidFundingDuration();
    error InvalidOperatingDuration();
    error InvalidFee();

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function createVenue(
        uint256 _fundingDuration,
        uint256 _operatingDuration,
        uint256 _fundingGoal,
        uint256 _operatorFeePercentage
    ) external returns (address) {
        if (_fundingDuration == 0) revert InvalidFundingDuration();
        if (_operatingDuration == 0) revert InvalidOperatingDuration();
        if (_fundingGoal == 0) revert InvalidFundingGoal();
        if (_operatorFeePercentage > 100) revert InvalidFee();

        address operator = msg.sender;

        VenueFi newVenue = new VenueFi(
            _fundingDuration,
            _operatingDuration,
            _fundingGoal,
            operator,
            _operatorFeePercentage
        );

        address venueAddress = address(newVenue);

        venues.push(venueAddress);
        venuesByOperator[operator].push(venueAddress);

        emit VenueCreated(venueAddress, operator, _fundingGoal, _fundingDuration);

        return venueAddress;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getVenuesCount() external view returns (uint256) {
        return venues.length;
    }

    function getVenuesByOperator(address _operator) external view returns (address[] memory) {
        return venuesByOperator[_operator];
    }
}
