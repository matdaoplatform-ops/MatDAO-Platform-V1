// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MatDAO_Escrow
 * @dev Milestone-based escrow contract for funding research projects with advanced DeFi features
 * Includes emergency refund, royalty waterfall, platform fees, and dividend distribution
 *
 * ---------------------------------------------------------------------------
 * KNOWN ECONOMIC LIMITATIONS (demo / testnet design - intentionally NOT
 * redesigned here; each item is a candidate for a follow-up audit):
 *
 *  1. IPT is not minted by this contract. Investors call `fundProject` with
 *     USDC but receive no on-chain claim in return; IPT is distributed by the
 *     MatDAO admin (MockIPT.mint) out-of-band. Refund and dividend shares are
 *     therefore only as fair as that off-chain distribution.
 *
 *  2. Dividend accounting is balance-based, not snapshot-based. A holder that
 *     claims, transfers IPT to a fresh wallet and claims again can collect the
 *     same tokens' share twice (see `claimDividends`). The payout is capped by
 *     the un-claimed dividend pool so milestone funds can never be drained this
 *     way, but other holders can be shorted. TODO: switch to snapshot-based or
 *     "magnified dividends per share" accounting (requires transfer hooks on
 *     the IPT token, e.g. ERC20Snapshot) - too invasive for this pass.
 *
 *  3. Milestone funds and the dividend pool share one USDC balance. After
 *     `toggleProjectFailure`, `claimEmergencyRefund` distributes the WHOLE
 *     balance (including un-claimed dividends) pro-rata to refund claimants.
 *
 *  4. The 2.5% platform fee is deducted once at the funding goal and then the
 *     same 2.5% is withheld from each milestone claim; the two are consistent
 *     (goal * 97.5% == sum of net milestone payouts) but the fee is not
 *     collected per-claim, it is simply never paid out.
 *
 *  5. `depositRoyalties` is permissionless: anyone can deposit USDC and 40% of
 *     it is immediately forwarded to the treasury and researcher.
 * ---------------------------------------------------------------------------
 */
contract MatDAO_Escrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Milestone {
        string description;
        uint256 amount;
        bool isApproved;
        bool isWithdrawn;
    }

    // State variables
    IERC20 public fundingToken;
    IERC20 public iptToken;
    address public researcher;
    address public matdaoTreasury;
    uint256 public totalFundingGoal;
    uint256 public currentFunding;
    Milestone[] public milestones;
    bool public projectFunded;
    bool public isProjectFailed;
    
    // Platform fee (2.5% = 250 basis points)
    uint256 public constant PLATFORM_FEE_BPS = 250;
    
    // Royalty waterfall
    uint256 public totalDividendPool;
    /// @notice Sum of all dividends paid out so far (never exceeds totalDividendPool).
    uint256 public totalDividendsClaimed;
    mapping(address => uint256) public claimedDividends;

    /// @notice IPT surrendered in an emergency refund is sent here so it can never
    /// be re-used for another refund (the escrow only holds an IERC20 handle, so
    /// it cannot burn). The tokens still count towards totalSupply(), which keeps
    /// later refunds proportional.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // Events
    event ProjectFunded(address indexed investor, uint256 amount);
    event MilestoneApproved(uint256 indexed milestoneId);
    event MilestoneClaimed(uint256 indexed milestoneId, uint256 amount);
    event FundingGoalReached(uint256 totalAmount);
    event ProjectFailed();
    event EmergencyRefundClaimed(address indexed investor, uint256 refundAmount);
    event RoyaltiesDeposited(uint256 amount, uint256 daoFee, uint256 researcherFee, uint256 investorPool);
    event DividendClaimed(address indexed investor, uint256 amount);
    event PlatformFeeCollected(uint256 amount);
    event IPTBurnedForRefund(address indexed investor, uint256 iptAmount);

    /**
     * @dev Constructor to initialize the escrow contract
     * @param _fundingToken The ERC20 token used for funding (e.g., MockUSDC)
     * @param _iptToken The Investment Participation Token
     * @param _researcher The address of the researcher
     * @param _matdaoTreasury The MatDAO treasury address for fees
     * @param _milestoneDescriptions Array of milestone descriptions
     * @param _milestoneAmounts Array of milestone amounts (must match descriptions length)
     */
    constructor(
        address _fundingToken,
        address _iptToken,
        address _researcher,
        address _matdaoTreasury,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) {
        require(_fundingToken != address(0), "Invalid funding token");
        require(_iptToken != address(0), "Invalid IPT token");
        require(_researcher != address(0), "Invalid researcher address");
        require(_matdaoTreasury != address(0), "Invalid treasury address");
        require(
            _milestoneDescriptions.length == _milestoneAmounts.length,
            "Milestone arrays length mismatch"
        );
        require(_milestoneDescriptions.length > 0, "At least one milestone required");

        fundingToken = IERC20(_fundingToken);
        iptToken = IERC20(_iptToken);
        researcher = _researcher;
        matdaoTreasury = _matdaoTreasury;

        // Create milestones and calculate total funding goal
        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            milestones.push(
                Milestone({
                    description: _milestoneDescriptions[i],
                    amount: _milestoneAmounts[i],
                    isApproved: false,
                    isWithdrawn: false
                })
            );
            totalFundingGoal += _milestoneAmounts[i];
        }
    }

    /**
     * @dev Fund the project by transferring tokens to the escrow
     * @param amount The amount of tokens to deposit
     */
    function fundProject(uint256 amount) external nonReentrant {
        require(!projectFunded, "Project already fully funded");
        require(!isProjectFailed, "Project has failed");
        require(amount > 0, "Amount must be > 0");
        // Over-funding would strand USDC in the contract (milestones only ever
        // pay out totalFundingGoal), so cap contributions at the remaining goal.
        require(currentFunding + amount <= totalFundingGoal, "Exceeds remaining funding goal");

        // Transfer tokens from investor to contract
        fundingToken.safeTransferFrom(msg.sender, address(this), amount);
        currentFunding += amount;

        emit ProjectFunded(msg.sender, amount);

        // Check if funding goal is reached
        if (currentFunding >= totalFundingGoal) {
            projectFunded = true;
            
            // Collect platform fee (2.5%)
            uint256 platformFee = (totalFundingGoal * PLATFORM_FEE_BPS) / 10000;
            if (platformFee > 0) {
                fundingToken.safeTransfer(matdaoTreasury, platformFee);
                emit PlatformFeeCollected(platformFee);
            }
            
            emit FundingGoalReached(currentFunding);
        }
    }

    /**
     * @dev Approve a milestone (admin only)
     * @param milestoneId The index of the milestone to approve
     */
    function approveMilestone(uint256 milestoneId) external onlyOwner {
        require(milestoneId < milestones.length, "Invalid milestone ID");
        require(projectFunded, "Project must be fully funded first");
        require(!isProjectFailed, "Project has failed");
        require(!milestones[milestoneId].isApproved, "Milestone already approved");

        milestones[milestoneId].isApproved = true;
        emit MilestoneApproved(milestoneId);
    }

    /**
     * @dev Claim an approved milestone (researcher only)
     * @param milestoneId The index of the milestone to claim
     */
    function claimMilestone(uint256 milestoneId) external nonReentrant {
        require(msg.sender == researcher, "Only researcher can claim");
        require(milestoneId < milestones.length, "Invalid milestone ID");
        require(
            milestones[milestoneId].isApproved,
            "Milestone must be approved first"
        );
        require(
            !milestones[milestoneId].isWithdrawn,
            "Milestone already withdrawn"
        );
        require(!isProjectFailed, "Project has failed");

        uint256 amount = milestones[milestoneId].amount;
        milestones[milestoneId].isWithdrawn = true;

        // Transfer milestone amount to researcher (accounting for platform fee)
        uint256 netAmount = amount;
        if (projectFunded) {
            // If project was fully funded, account for platform fee
            uint256 platformFee = (amount * PLATFORM_FEE_BPS) / 10000;
            netAmount = amount - platformFee;
        }
        
        fundingToken.safeTransfer(researcher, netAmount);

        emit MilestoneClaimed(milestoneId, netAmount);
    }

    /**
     * @dev Toggle project failure status (admin only)
     * Enables emergency refund mechanism for investors
     */
    function toggleProjectFailure() external onlyOwner {
        require(projectFunded, "Project must be funded first");
        require(!isProjectFailed, "Project already failed");
        
        isProjectFailed = true;
        emit ProjectFailed();
    }

    /**
     * @dev Claim emergency refund by surrendering IPT tokens (investor only)
     * Returns proportional share of remaining escrow funds.
     *
     * The caller must first `approve` this contract for their full IPT balance.
     * The IPT is pulled and sent to BURN_ADDRESS so the same tokens can never
     * claim a second refund. See contract-level NatSpec, item 3, for what
     * "remaining escrow funds" includes.
     */
    function claimEmergencyRefund() external nonReentrant {
        require(isProjectFailed, "Project must be failed first");
        
        uint256 investorIPT = iptToken.balanceOf(msg.sender);
        require(investorIPT > 0, "No IPT tokens held");
        
        uint256 contractUSDC = fundingToken.balanceOf(address(this));
        uint256 totalIPT = iptToken.totalSupply();
        
        // Calculate proportional refund
        uint256 refundAmount = (investorIPT * contractUSDC) / totalIPT;
        require(refundAmount > 0, "No refund available");
        
        // Lock the surrendered IPT permanently (effects before interactions with USDC)
        iptToken.safeTransferFrom(msg.sender, BURN_ADDRESS, investorIPT);
        emit IPTBurnedForRefund(msg.sender, investorIPT);
        
        // Transfer refund to investor
        fundingToken.safeTransfer(msg.sender, refundAmount);
        
        emit EmergencyRefundClaimed(msg.sender, refundAmount);
    }

    /**
     * @dev Deposit royalties from enterprise licensing
     * Automatically splits: 10% to MatDAO, 30% to researcher, 60% to dividend pool
     * @param amount The amount of USDC to deposit as royalties
     */
    function depositRoyalties(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        // Transfer USDC from caller to contract
        fundingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate splits
        uint256 daoFee = (amount * 10) / 100;
        uint256 researcherFee = (amount * 30) / 100;
        uint256 investorPool = amount - daoFee - researcherFee;
        
        // Transfer splits
        fundingToken.safeTransfer(matdaoTreasury, daoFee);
        fundingToken.safeTransfer(researcher, researcherFee);
        
        // Add to dividend pool
        totalDividendPool += investorPool;
        
        emit RoyaltiesDeposited(amount, daoFee, researcherFee, investorPool);
    }

    /**
     * @dev Claim dividends from royalty pool (IPT holders only)
     * Returns proportional share of unclaimed dividends.
     *
     * Accounting: each address's lifetime entitlement is
     *   balanceOf(user) * totalDividendPool / totalSupply()
     * and `claimedDividends[user]` records what has already been paid, so a
     * single address can never be paid twice for the same deposit. The payout
     * is additionally capped at `totalDividendPool - totalDividendsClaimed`,
     * which guarantees dividend claims can never touch escrowed milestone
     * funds.
     *
     * TODO(economics): this is still balance-based - tokens moved to a fresh
     * address after a claim regain a full entitlement (contract-level NatSpec,
     * item 2). A correct fix needs per-deposit snapshots of IPT balances
     * (ERC20Snapshot) or transfer hooks on the IPT token.
     */
    function claimDividends() external nonReentrant {
        uint256 claimable = getClaimableDividends(msg.sender);
        require(claimable > 0, "No claimable dividends");
        
        // Update claimed amounts (effects) before transferring (interaction)
        claimedDividends[msg.sender] += claimable;
        totalDividendsClaimed += claimable;
        
        // Transfer dividends to user
        fundingToken.safeTransfer(msg.sender, claimable);
        
        emit DividendClaimed(msg.sender, claimable);
    }

    /**
     * @dev Get the number of milestones
     */
    function getMilestoneCount() public view returns (uint256) {
        return milestones.length;
    }

    /**
     * @dev Get milestone details
     * @param milestoneId The index of the milestone
     */
    function getMilestone(uint256 milestoneId)
        public
        view
        returns (
            string memory description,
            uint256 amount,
            bool isApproved,
            bool isWithdrawn
        )
    {
        require(milestoneId < milestones.length, "Invalid milestone ID");
        Milestone memory m = milestones[milestoneId];
        return (m.description, m.amount, m.isApproved, m.isWithdrawn);
    }

    /**
     * @dev Get all milestones
     */
    function getAllMilestones()
        public
        view
        returns (
            string[] memory descriptions,
            uint256[] memory amounts,
            bool[] memory approved,
            bool[] memory withdrawn
        )
    {
        uint256 count = milestones.length;
        descriptions = new string[](count);
        amounts = new uint256[](count);
        approved = new bool[](count);
        withdrawn = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            Milestone memory m = milestones[i];
            descriptions[i] = m.description;
            amounts[i] = m.amount;
            approved[i] = m.isApproved;
            withdrawn[i] = m.isWithdrawn;
        }
    }

    /**
     * @dev Get funding progress
     */
    function getFundingProgress()
        public
        view
        returns (uint256 current, uint256 goal, uint256 percentage)
    {
        current = currentFunding;
        goal = totalFundingGoal;
        percentage = (current * 100) / goal;
    }

    /**
     * @dev Get claimable dividends for an address
     * @param user The address to check
     */
    function getClaimableDividends(address user) public view returns (uint256) {
        uint256 userIPT = iptToken.balanceOf(user);
        if (userIPT == 0) return 0;
        uint256 totalIPT = iptToken.totalSupply();
        if (totalIPT == 0) return 0;
        
        uint256 totalShare = (userIPT * totalDividendPool) / totalIPT;
        uint256 alreadyClaimed = claimedDividends[user];
        if (totalShare <= alreadyClaimed) return 0;
        uint256 claimable = totalShare - alreadyClaimed;
        
        // Never pay out more than what is left in the dividend pool
        uint256 poolRemaining = totalDividendPool - totalDividendsClaimed;
        return claimable > poolRemaining ? poolRemaining : claimable;
    }

    /**
     * @dev Get emergency refund estimate for an address
     * @param user The address to check
     */
    function getEmergencyRefundEstimate(address user) public view returns (uint256) {
        if (!isProjectFailed) return 0;
        
        uint256 investorIPT = iptToken.balanceOf(user);
        uint256 contractUSDC = fundingToken.balanceOf(address(this));
        uint256 totalIPT = iptToken.totalSupply();
        
        if (totalIPT == 0) return 0;
        
        return (investorIPT * contractUSDC) / totalIPT;
    }

    /**
     * @dev Get financial breakdown including platform fee
     */
    function getFinancialBreakdown()
        public
        view
        returns (
            uint256 totalGoal,
            uint256 platformFee,
            uint256 netRunway
        )
    {
        totalGoal = totalFundingGoal;
        platformFee = (totalFundingGoal * PLATFORM_FEE_BPS) / 10000;
        netRunway = totalFundingGoal - platformFee;
    }
}
