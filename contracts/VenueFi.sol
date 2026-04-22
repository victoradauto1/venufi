// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VenueFi is ReentrancyGuard {
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

    /// @notice The minimum amount of tokens to be raised to successfully end the campaign
    uint256 public fundingGoal;

    mapping(address => uint256) public balance;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Invested(address indexed investor, uint256 amount);
    event Refunded(address indexed investor, uint256 amount);
    event Deposited(address indexed depositor, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotFunding();
    error FundingEnded();
    error ZeroValue();
    error NotRefund();
    error DeadlineNotReached();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(uint256 _deadline, uint256 _fundingGoal) {
        deadline = block.timestamp + _deadline;
        fundingGoal = _fundingGoal;
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
                              FUNCTION REFUND()
    //////////////////////////////////////////////////////////////*/

    /// @notice Refund the investment
    function refund(uint256 amount) external nonReentrant {
        if (state != State.ACTIVE) revert NotRefund();
        if (balance[msg.sender] == 0) revert ZeroValue();
        if (amount == 0) revert ZeroValue();
        if (amount > balance[msg.sender]) revert NotRefund();

        balance[msg.sender] -= amount;
        totalInvested -= amount;
        totalRaised -= amount;
        totalSupply -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert NotRefund();
        emit Refunded(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION FINALIZE FUNDING()
    //////////////////////////////////////////////////////////////*/

    /// @notice Finalize the funding period
    function finalizeFunding() external {
        if (totalRaised > fundingGoal) {
            state = State.ACTIVE;
        } else {
            if (block.timestamp > deadline) {
                state = State.ENDED;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION DEPOSIT REVENUE()
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit revenue into the campaign
    function depositRevenue() external payable {
        if (state != State.ACTIVE) revert NotRefund();
        if (msg.value == 0) revert ZeroValue();

        totalRaised += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
