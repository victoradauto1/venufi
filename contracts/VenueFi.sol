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

    /// @notice Deadline for the funding period
    uint256 public deadline;

    /// @notice Historical total amount raised during the funding period (immutable after funding)
    uint256 public totalRaised;

    /// @notice Current capital held in the contract (decreases on refund)
    uint256 public currentRaised;

    /// @notice Total revenue deposited into the campaign by the operator
    uint256 public totalRevenue;

    /// @notice Total supply of shares
    uint256 public totalSupply;

    /// @notice The minimum amount of ETH required to finalize the campaign
    uint256 public fundingGoal;

    /// @notice Accumulated revenue per token, scaled by PRECISION
    uint256 public accRevenuePerToken;

    /// @notice Precision factor for fixed-point arithmetic
    uint256 public constant PRECISION = 1e18;

    /// @notice The percentage of revenue the operator receives (0-100)
    uint256 public operatorFeePercentage;

    /// @notice The address that receives the operator fee
    address public operator;

    /// @notice Accumulated operator fees available for withdrawal
    uint256 public operatorFeesAccrued;

    /// @notice Mapping of investor share balances
    mapping(address => uint256) public balance;

    /// @notice Mapping of investor reward debts (used to calculate pending revenue)
    mapping(address => uint256) public rewardDebt;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a user invests in the campaign
    event Invested(address indexed investor, uint256 amount);

    /// @notice Emitted when a user refunds their investment
    event Refunded(address indexed investor, uint256 amount);

    /// @notice Emitted when revenue is deposited into the campaign
    event Deposited(address indexed depositor, uint256 amount);

    /// @notice Emitted when a user claims their pending revenue
    event Claimed(address indexed user, uint256 amount);

    /// @notice Emitted when the campaign state changes
    event StateChanged(State newState);

    /// @notice Emitted when the operator withdraws their accrued fees
    event OperatorWithdrawn(address indexed operator, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when action requires FUNDING state
    error NotFunding();

    /// @notice Thrown when action requires ENDED state
    error NotEnded();

    /// @notice Thrown when the funding deadline has not been reached yet
    error DeadlineNotReached();

    /// @notice Thrown when the funding deadline has already passed
    error FundingEnded();

    /// @notice Thrown when a zero value is provided
    error ZeroValue();

    /// @notice Thrown when an ETH transfer fails
    error TransferFailed();

    /// @notice Thrown when action requires ACTIVE state
    error NotActive();

    /// @notice Thrown when depositRevenue is called with no investors
    error NoInvestors();

    /// @notice Thrown when funding goal has been reached and operation is not allowed
    error FundingGoalReached();

    /// @notice Thrown when funding goal has not been reached and operation is not allowed
    error FundingGoalNotReached();

    /// @notice Thrown when the caller is not the operator
    error NotOperator();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Constructor for the VenueFi contract
    /// @param _deadline Duration of the funding period in seconds
    /// @param _fundingGoal Minimum amount of ETH required to finalize the campaign
    /// @param _operator Address that receives the operator fee
    /// @param _operatorFeePercentage Percentage of revenue the operator receives (0-100)
    constructor(
        uint256 _deadline,
        uint256 _fundingGoal,
        address _operator,
        uint256 _operatorFeePercentage
    ) {
        deadline = block.timestamp + _deadline;
        fundingGoal = _fundingGoal;
        operator = _operator;
        operatorFeePercentage = _operatorFeePercentage;
        state = State.FUNDING;
    }

    /*//////////////////////////////////////////////////////////////
                        INVESTMENT IMPLEMENTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Invest ETH into the campaign during the FUNDING period
    function invest() external payable {
        if (state != State.FUNDING) revert NotFunding();
        if (block.timestamp >= deadline) revert FundingEnded();
        if (msg.value == 0) revert ZeroValue();

        totalRaised += msg.value;
        currentRaised += msg.value;
        balance[msg.sender] += msg.value;
        totalSupply += msg.value;

        // synchronize rewardDebt so investor does not capture past revenue
        rewardDebt[msg.sender] = (balance[msg.sender] * accRevenuePerToken) / PRECISION;

        emit Invested(msg.sender, msg.value);
    }

    /// @notice Returns the share balance of a user
    /// @param user The address of the user
    /// @return The amount of shares owned by the user
    function getUserShares(address user) external view returns (uint256) {
        return balance[user];
    }

    /*//////////////////////////////////////////////////////////////
                              FUNCTION REFUND()
    //////////////////////////////////////////////////////////////*/

    /// @notice Refund the full investment
    /// @dev Only callable in ENDED state — campaign must have expired without reaching goal
    function refund() external nonReentrant {
        if (state != State.ENDED) revert NotEnded();
        if (balance[msg.sender] == 0) revert ZeroValue();

        uint256 amount = balance[msg.sender];

        balance[msg.sender] = 0;
        currentRaised -= amount;
        totalSupply -= amount;
        rewardDebt[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Refunded(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION FINALIZE FUNDING()
    //////////////////////////////////////////////////////////////*/

    /// @notice Finalize the campaign when the funding goal has been reached
    /// @dev Allows early finalization if funding goal is reached before deadline
    /// @dev Transitions state from FUNDING to ACTIVE
    function finalizeFunding() external {
        if (state != State.FUNDING) revert NotFunding();
        if (totalRaised < fundingGoal) revert FundingGoalNotReached();

        state = State.ACTIVE;
        emit StateChanged(State.ACTIVE);
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION EXPIRE FUNDING()
    //////////////////////////////////////////////////////////////*/

    /// @notice Expire the campaign when deadline has passed and goal was not reached
    /// @dev Transitions state from FUNDING to ENDED, enabling refunds
    function expireFunding() external {
        if (state != State.FUNDING) revert NotFunding();
        if (block.timestamp <= deadline) revert DeadlineNotReached();
        if (totalRaised >= fundingGoal) revert FundingGoalReached();

        state = State.ENDED;
        emit StateChanged(State.ENDED);
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION DEPOSIT REVENUE()
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit revenue to be distributed proportionally to investors
    /// @dev Operator fee is deducted at deposit time and accrued for later withdrawal
    /// @dev Remaining revenue updates accRevenuePerToken for investor distribution
    function depositRevenue() external payable {
        if (state != State.ACTIVE) revert NotActive();
        if (msg.value == 0) revert ZeroValue();
        if (totalSupply == 0) revert NoInvestors();

        uint256 fee = (msg.value * operatorFeePercentage) / 100;
        uint256 investorRevenue = msg.value - fee;

        operatorFeesAccrued += fee;
        accRevenuePerToken += (investorRevenue * PRECISION) / totalSupply;
        totalRevenue += investorRevenue;

        emit Deposited(msg.sender, msg.value);
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION PENDING()
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the pending revenue for a user
    /// @param user The address of the user
    /// @return The amount of claimable revenue for the user
    /// @dev Returns 0 defensively if accumulated < rewardDebt to avoid underflow.
    ///      This should never happen in normal operation — if it does, it indicates
    ///      a rewardDebt accounting bug elsewhere in the contract.
    function pending(address user) public view returns (uint256) {
        uint256 accumulated = (balance[user] * accRevenuePerToken) / PRECISION;
        if (accumulated < rewardDebt[user]) return 0;
        return accumulated - rewardDebt[user];
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION CLAIM REVENUE()
    //////////////////////////////////////////////////////////////*/

    /// @notice Claim all pending revenue for the caller
    /// @dev rewardDebt is updated before transfer following CEI pattern
    function claimRevenue() external nonReentrant {
        if (state != State.ACTIVE) revert NotActive();

        uint256 pendingRevenue = pending(msg.sender);
        if (pendingRevenue == 0) revert ZeroValue();

        rewardDebt[msg.sender] = (balance[msg.sender] * accRevenuePerToken) / PRECISION;

        (bool success, ) = msg.sender.call{value: pendingRevenue}("");
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, pendingRevenue);
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION WITHDRAW OPERATOR FEES()
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraw all accrued operator fees
    /// @dev Only callable by the operator address
    function withdrawOperatorFees() external nonReentrant {
        if (msg.sender != operator) revert NotOperator();

        uint256 amount = operatorFeesAccrued;
        if (amount == 0) revert ZeroValue();

        operatorFeesAccrued = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit OperatorWithdrawn(msg.sender, amount);
    }
}