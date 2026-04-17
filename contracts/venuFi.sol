// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VenueFi {
    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/

    enum State {
        FUNDING,
        ACTIVE,
        ENDED
    }

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Current state of the campaign
    State public state;

    /// @notice Deadline for the campaign
    uint256 public deadline;

    /// @notice Total amount raised in the campaign
    uint256 public totalRaised;

    /// @notice Total invested amount
    uint256 public totalInvested;

    /// @notice Total supply of tokens
    uint256 public totalSupply;

    mapping(address => uint256) public balance;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Invested(address indexed investor, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotFunding();
    error FundingEnded();
    error ZeroValue();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(uint256 _deadline) {
        deadline = block.timestamp + _deadline;
        state = State.FUNDING;
    }

    /*//////////////////////////////////////////////////////////////
                        INVESTMENT IMPLEMENTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Invest in the campaign
    function invest() external payable {
        if (state != State.FUNDING) revert NotFunding();
        if (block.timestamp >= deadline) revert FundingEnded();
        if (msg.value == 0) revert ZeroValue();

        totalRaised += msg.value;
        totalInvested += msg.value;
        balance[msg.sender] += msg.value;
        totalSupply += msg.value;

        emit Invested(msg.sender, msg.value);
    }

    /// @notice Returns the shares of a user
    function getUserShares(address user) external view returns (uint256) {
        return balance[user];
    }

    /*//////////////////////////////////////////////////////////////
                              FUNCTION CLOSE FUNDING()
    //////////////////////////////////////////////////////////////*/

    /// @notice Close the funding
    function closeFunding() external {
        state = State.ACTIVE;
    }
}
