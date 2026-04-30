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

    State public state;

    /// @notice Deadline for the funding phase
    uint256 public deadline;

    /// @notice End of operating period (set at finalizeFunding)
    uint256 public endTime;

    /// @notice Duration added to endTime when funding is finalized
    uint256 public operatingDuration;

    /// @notice Total ETH raised during funding (immutable after)
    uint256 public totalRaised;

    /// @notice Tracks withdrawable capital (independent from totalRaised)
    uint256 public currentRaised;

    /// @notice Total revenue distributed to investors (net of fees)
    uint256 public totalRevenue;

    uint256 public totalSupply;

    uint256 public fundingGoal;

    /// @notice Accumulated revenue per share (scaled)
    uint256 public accRevenuePerToken;

    uint256 public constant PRECISION = 1e18;

    uint256 public operatorFeePercentage;

    address public operator;

    /// @notice Fees accumulated for operator withdrawal
    uint256 public operatorFeesAccrued;

    mapping(address => uint256) public balance;

    /// @notice Tracks claimed share of accRevenuePerToken per user
    mapping(address => uint256) public rewardDebt;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Invested(address indexed investor, uint256 amount);

    event Refunded(address indexed investor, uint256 amount);

    event Deposited(address indexed depositor, uint256 amount);

    event Claimed(address indexed user, uint256 amount);

    event StateChanged(State newState);

    event OperatorWithdrawn(address indexed operator, uint256 amount);

    event CapitalWithdrawn(address indexed operator, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotFunding();

    error NotEnded();

    error DeadlineNotReached();

    error FundingEnded();

    error ZeroValue();

    error TransferFailed();

    error NotActive();

    error NoInvestors();

    error FundingGoalReached();

    error FundingGoalNotReached();

    error NotOperator();

    error InvalidFeePercentage();

    /// @notice finalizeCampaign called before endTime
    error CampaignNotEnded();

    /// @notice depositRevenue called after endTime
    error CampaignAlreadyEnded();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _fundingDeadline Duration of funding phase
    /// @param _operatingDuration Duration of ACTIVE phase (starts at finalizeFunding)
    /// @param _fundingGoal Minimum capital required
    /// @param _operator Address receiving fees and capital
    /// @param _operatorFeePercentage Fee taken on each revenue deposit
    constructor(
        uint256 _fundingDeadline,
        uint256 _operatingDuration,
        uint256 _fundingGoal,
        address _operator,
        uint256 _operatorFeePercentage
    ) {
        if (_operatorFeePercentage > 100) revert InvalidFeePercentage();

        deadline = block.timestamp + _fundingDeadline;
        operatingDuration = _operatingDuration;
        fundingGoal = _fundingGoal;
        operator = _operator;
        operatorFeePercentage = _operatorFeePercentage;
        state = State.FUNDING;
    }

    /*//////////////////////////////////////////////////////////////
                        INVESTMENT IMPLEMENTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit ETH during FUNDING and receive shares
    function invest() external payable {
        if (state != State.FUNDING) revert NotFunding();
        if (block.timestamp >= deadline) revert FundingEnded();
        if (msg.value == 0) revert ZeroValue();

        totalRaised += msg.value;
        currentRaised += msg.value;
        balance[msg.sender] += msg.value;
        totalSupply += msg.value;

        // prevents capturing past revenue
        rewardDebt[msg.sender] = (balance[msg.sender] * accRevenuePerToken) / PRECISION;

        emit Invested(msg.sender, msg.value);
    }

    function getUserShares(address user) external view returns (uint256) {
        return balance[user];
    }

    /*//////////////////////////////////////////////////////////////
                              FUNCTION REFUND()
    //////////////////////////////////////////////////////////////*/

    /// @dev Only valid if campaign expired without reaching goal
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

    /// @notice Transitions FUNDING → ACTIVE when goal is reached
    /// @dev Starts operating period at call time (not deployment)
    function finalizeFunding() external {
        if (state != State.FUNDING) revert NotFunding();
        if (totalRaised < fundingGoal) revert FundingGoalNotReached();

        endTime = block.timestamp + operatingDuration;
        state = State.ACTIVE;

        emit StateChanged(State.ACTIVE);
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION EXPIRE FUNDING()
    //////////////////////////////////////////////////////////////*/

    /// @dev Only callable after deadline if goal was not reached
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

    /// @dev Distributes revenue using accumulator model
    /// @dev Fee is extracted upfront to avoid retroactive distortion
    function depositRevenue() external payable {
        if (msg.sender != operator) revert NotOperator();
        if (state != State.ACTIVE) revert NotActive();
        if (block.timestamp >= endTime) revert CampaignAlreadyEnded();
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

    /// @dev Defensive guard prevents underflow if accounting is inconsistent
    function pending(address user) public view returns (uint256) {
        uint256 accumulated = (balance[user] * accRevenuePerToken) / PRECISION;
        if (accumulated < rewardDebt[user]) return 0;
        return accumulated - rewardDebt[user];
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION CLAIM REVENUE()
    //////////////////////////////////////////////////////////////*/

    /// @dev Always callable outside FUNDING to prevent locked rewards
    /// @dev CEI pattern enforced
    function claimRevenue() external nonReentrant {
        if (state == State.FUNDING) revert NotActive();

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

    /// @dev Fees are accumulated at deposit time, not claim time
    function withdrawOperatorFees() external nonReentrant {
        if (msg.sender != operator) revert NotOperator();

        uint256 amount = operatorFeesAccrued;
        if (amount == 0) revert ZeroValue();

        operatorFeesAccrued = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit OperatorWithdrawn(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION WITHDRAW CAPITAL()
    //////////////////////////////////////////////////////////////*/

    /// @dev Trust-based: operator controls capital deployment
    function withdrawCapital() external nonReentrant {
        if (msg.sender != operator) revert NotOperator();
        if (state != State.ACTIVE) revert NotActive();

        uint256 amount = currentRaised;
        if (amount == 0) revert ZeroValue();

        currentRaised = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit CapitalWithdrawn(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        FUNCTION FINALIZE CAMPAIGN()
    //////////////////////////////////////////////////////////////*/

    /// @dev Permissionless after endTime to avoid stuck ACTIVE state
    function finalizeCampaign() external {
        if (state != State.ACTIVE) revert NotActive();
        if (block.timestamp < endTime) revert CampaignNotEnded();

        state = State.ENDED;
        emit StateChanged(State.ENDED);
    }
}