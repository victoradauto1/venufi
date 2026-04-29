const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("VenueFi", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const VenueFi = await ethers.getContractFactory("VenueFi");
    const venue = await VenueFi.deploy(
      3600, // funding deadline: 1h
      31536000, // operating duration: 1 year
      ethers.parseEther("1"),
      owner.address,
      10n,
    );

    await venue.waitForDeployment();

    return { venue, owner, user1, user2 };
  }

  async function activateVenue(venue: any, user: any) {
    await venue.connect(user).invest({ value: ethers.parseEther("1.1") });
    await venue.finalizeFunding();
  }

  async function expireVenue(venue: any, user: any) {
    await venue.connect(user).invest({ value: ethers.parseEther("0.1") });
    const deadline = await venue.deadline();
    await time.increaseTo(deadline + 1n);
    await venue.expireFunding();
  }

  describe("Deployment", function () {
    it("Should deploy the contract", async function () {
      const { venue } = await loadFixture(deployFixture);
      expect(venue).to.not.be.undefined;
    });

    it("should revert InvalidFeePercentage if fee > 100", async function () {
  const [owner] = await ethers.getSigners();
  const VenueFi = await ethers.getContractFactory("VenueFi");
  const venue = await VenueFi.deploy(3600, 31536000, ethers.parseEther("1"), owner.address, 10n);
  await expect(
    VenueFi.deploy(3600, 31536000, ethers.parseEther("1"), owner.address, 101n)
  ).to.be.revertedWithCustomError(venue, "InvalidFeePercentage");
});
  });

  describe("Investing", function () {
    it("should allow users to invest with ETH", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      expect(await venue.getUserShares(user1.address)).to.equal(
        investmentAmount,
      );
    });

    it("should revert ZeroValue if no ETH sent", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await expect(
        venue.connect(user1).invest({ value: 0n }),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should increase totalRaised after invest", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      expect(await venue.totalRaised()).to.equal(investmentAmount);
    });

    it("should revert NotFunding if not in FUNDING state", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      await activateVenue(venue, user2);
      await expect(
        venue.connect(user1).invest({ value: ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(venue, "NotFunding");
    });

    it("should revert FundingEnded if deadline passed", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await expect(
        venue.connect(user1).invest({ value: ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(venue, "FundingEnded");
    });

    it("should emit Invested event", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await expect(venue.connect(user1).invest({ value: investmentAmount }))
        .to.emit(venue, "Invested")
        .withArgs(user1.address, investmentAmount);
    });
  });

  describe("Finalize Funding", function () {
    it("should go to ACTIVE if totalRaised >= fundingGoal", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await venue.finalizeFunding();
      expect(await venue.state()).to.equal(1);
    });

    it("should revert NotFunding if already ACTIVE", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(venue.finalizeFunding()).to.be.revertedWithCustomError(
        venue,
        "NotFunding",
      );
    });

    it("should revert FundingGoalNotReached if below goal", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await expect(venue.finalizeFunding()).to.be.revertedWithCustomError(
        venue,
        "FundingGoalNotReached",
      );
    });

    it("should emit StateChanged event", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await expect(venue.finalizeFunding())
        .to.emit(venue, "StateChanged")
        .withArgs(1);
    });
  });

  describe("Expire Funding", function () {
    it("should go to ENDED if deadline passed and goal not reached", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await venue.expireFunding();
      expect(await venue.state()).to.equal(2);
    });

    it("should revert NotFunding if already ENDED", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await expireVenue(venue, user1);
      await expect(venue.expireFunding()).to.be.revertedWithCustomError(
        venue,
        "NotFunding",
      );
    });

    it("should revert DeadlineNotReached if deadline not passed", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await expect(venue.expireFunding()).to.be.revertedWithCustomError(
        venue,
        "DeadlineNotReached",
      );
    });

    it("should revert FundingGoalReached if goal was met", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await expect(venue.expireFunding()).to.be.revertedWithCustomError(
        venue,
        "FundingGoalReached",
      );
    });

    it("should emit StateChanged event", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await expect(venue.expireFunding())
        .to.emit(venue, "StateChanged")
        .withArgs(2);
    });
  });

  describe("Refund", function () {
    it("should revert NotEnded if not in ENDED state", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await expect(venue.connect(user1).refund()).to.be.revertedWithCustomError(
        venue,
        "NotEnded",
      );
    });

    it("should revert ZeroValue if user has no shares", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      await expireVenue(venue, user1);
      await expect(venue.connect(user2).refund()).to.be.revertedWithCustomError(
        venue,
        "ZeroValue",
      );
    });

    it("should allow full refund successfully", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await venue.expireFunding();
      await venue.connect(user1).refund();
      expect(await venue.getUserShares(user1.address)).to.equal(0n);
    });

    it("should emit Refunded event", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await venue.expireFunding();
      await expect(venue.connect(user1).refund())
        .to.emit(venue, "Refunded")
        .withArgs(user1.address, investmentAmount);
    });

    it("should revert TransferFailed if ETH transfer fails", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const [owner] = await ethers.getSigners();
      const venue2 = await VenueFi.deploy(3600, 31536000, ethers.parseEther("5"), owner.address, 10n);
      await venue2.waitForDeployment();

      const RejectEther = await ethers.getContractFactory("RejectEther");
      const rejecter = await RejectEther.deploy(await venue2.getAddress());

      await rejecter.doInvest({ value: ethers.parseEther("0.1") });
      const deadline = await venue2.deadline();
      await time.increaseTo(deadline + 1n);
      await venue2.expireFunding();

      await expect(rejecter.doRefund()).to.be.revertedWithCustomError(
        venue2,
        "TransferFailed",
      );
    });

    // CEI pattern zeroes the balance before the ETH transfer,
    // so re-entrance hits ZeroValue before the nonReentrant guard.
    // nonReentrant is kept as defense-in-depth per industry convention.
    it("should revert on reentrancy attack", async function () {
      const { venue } = await loadFixture(deployFixture);
      const Attacker = await ethers.getContractFactory("AttackerVenueFi");
      const attacker = await Attacker.deploy(await venue.getAddress());

      await attacker.doInvest({ value: ethers.parseEther("0.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await venue.expireFunding();

      const attackerAddress = await attacker.getAddress();
      expect(attackerAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Deposit Revenue", function () {
    it("should allow deposit when ACTIVE", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });
      // totalRevenue stores only the investor portion (90%)
      expect(await venue.totalRevenue()).to.equal(ethers.parseEther("0.45"));
    });

    it("should revert NotOperator if non-operator deposits revenue", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue
          .connect(user1)
          .depositRevenue({ value: ethers.parseEther("0.5") }),
      ).to.be.revertedWithCustomError(venue, "NotOperator");
    });

    it("should revert NotActive if not in ACTIVE state", async function () {
      const { venue, owner } = await loadFixture(deployFixture);
      await expect(
        venue
          .connect(owner)
          .depositRevenue({ value: ethers.parseEther("0.5") }),
      ).to.be.revertedWithCustomError(venue, "NotActive");
    });

    it("should revert ZeroValue if deposit amount is zero", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue.connect(owner).depositRevenue({ value: 0n }),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should emit Deposited event", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const depositAmount = ethers.parseEther("0.5");
      await expect(
        venue.connect(owner).depositRevenue({ value: depositAmount }),
      )
        .to.emit(venue, "Deposited")
        .withArgs(owner.address, depositAmount);
    });

    it("should update accRevenuePerToken after deposit", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });
      const acc = await venue.accRevenuePerToken();
      // investor portion = 90% of 0.5 = 0.45 ETH, totalSupply = 1 ETH
      const investorPortion = ethers.parseEther("0.45");
      const expected =
        (investorPortion * BigInt(1e18)) / ethers.parseEther("1");
      expect(acc).to.equal(expected);
    });

    it("should revert NoInvestors if totalSupply is zero", async function () {
      const [owner] = await ethers.getSigners();
      const Harness = await ethers.getContractFactory("VenueFiHarness");
      const harness = await Harness.deploy(
  3600,
  31536000,       // operating duration
  ethers.parseEther("1"),
  owner.address,
  10n,
);
      await harness.waitForDeployment();
      await harness.forceActive();
      await expect(
        harness
          .connect(owner)
          .depositRevenue({ value: ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(harness, "NoInvestors");
    });
  });

  describe("Pending Revenue", function () {
    it("should return zero before any revenue is deposited", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      expect(await venue.pending(user1.address)).to.equal(0n);
    });

    it("should return correct pending after revenue deposit", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });
      // user1 has 100% of supply — gets 90% of deposit = 0.45 ETH
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.45"),
      );
    });

    it("should split pending proportionally between investors", async function () {
      const { venue, user1, user2, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.connect(user2).invest({ value: ethers.parseEther("0.5") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });
      // investor portion = 0.27 ETH (90% of 0.3)
      // user1: 2/3 of 0.27 = 0.18, user2: 1/3 of 0.27 = 0.09
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.18"),
      );
      expect(await venue.pending(user2.address)).to.equal(
        ethers.parseEther("0.09"),
      );
    });

    it("should return zero for user with no shares", async function () {
      const { venue, user1, user2, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.5") });
      expect(await venue.pending(user2.address)).to.equal(0n);
    });

    it("should accumulate pending across multiple deposits", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.2") });
      // investor portion: 0.27 + 0.18 = 0.45 ETH
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.45"),
      );
    });

    it("should return zero from pending() if accumulated < rewardDebt", async function () {
      const [owner, user1] = await ethers.getSigners();
      const Harness = await ethers.getContractFactory("VenueFiHarness");
      const harness = await Harness.deploy(
  3600,
  31536000,       // operating duration
  ethers.parseEther("1"),
  owner.address,
  10n,
);
      await harness.waitForDeployment();
      await harness.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await harness.finalizeFunding();
      await harness.forceRewardDebt(user1.address, ethers.parseEther("999"));
      expect(await harness.pending(user1.address)).to.equal(0n);
    });
  });

  describe("Claim Revenue", function () {
    it("should revert NotActive if not in ACTIVE state", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await expect(
        venue.connect(user1).claimRevenue(),
      ).to.be.revertedWithCustomError(venue, "NotActive");
    });

    it("should revert ZeroValue if pending is zero", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue.connect(user1).claimRevenue(),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should revert ZeroValue if user has no shares", async function () {
      const { venue, user1, user2, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.5") });
      await expect(
        venue.connect(user2).claimRevenue(),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should transfer correct amount to user", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await venue.connect(user1).claimRevenue();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // user1 receives 90% of 0.5 ETH = 0.45 ETH
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(
        ethers.parseEther("0.45"),
      );
    });

    it("should zero out pending after claim", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.5") });
      await venue.connect(user1).claimRevenue();
      expect(await venue.pending(user1.address)).to.equal(0n);
    });

    it("should emit Claimed event", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });
      await expect(venue.connect(user1).claimRevenue())
        .to.emit(venue, "Claimed")
        .withArgs(user1.address, ethers.parseEther("0.45"));
    });

    it("should allow claim after multiple deposits", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.2") });
      await venue.connect(user1).claimRevenue();
      expect(await venue.pending(user1.address)).to.equal(0n);
    });

    it("should split claim correctly between two investors", async function () {
      const { venue, user1, user2, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.connect(user2).invest({ value: ethers.parseEther("0.5") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });

      await venue.connect(user1).claimRevenue();
      expect(await venue.pending(user1.address)).to.equal(0n);

      await venue.connect(user2).claimRevenue();
      expect(await venue.pending(user2.address)).to.equal(0n);
    });

    it("should accumulate new pending after claim", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });
      await venue.connect(user1).claimRevenue();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.2") });
      // 90% of 0.2 = 0.18 ETH
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.18"),
      );
    });

    it("should revert TransferFailed if ETH transfer fails on claim", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const [owner] = await ethers.getSigners();
      const venue2 = await VenueFi.deploy(3600, 31536000, ethers.parseEther("0.05"), owner.address, 10n);
      await venue2.waitForDeployment();

      const RejectEther = await ethers.getContractFactory("RejectEther");
      const rejecter = await RejectEther.deploy(await venue2.getAddress());

      await rejecter.doInvest({ value: ethers.parseEther("0.1") });
      await venue2.finalizeFunding();
      await venue2
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.1") });

      await expect(rejecter.doClaim()).to.be.revertedWithCustomError(
        venue2,
        "TransferFailed",
      );
    });
  });

  describe("Withdraw Operator Fees", function () {
    it("should revert NotOperator if caller is not operator", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await expect(
        venue.connect(user1).withdrawOperatorFees(),
      ).to.be.revertedWithCustomError(venue, "NotOperator");
    });

    it("should revert ZeroValue if no fees accrued", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue.connect(owner).withdrawOperatorFees(),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should transfer correct fee amount to operator", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await venue.connect(owner).withdrawOperatorFees();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      // 10% of 1 ETH = 0.1 ETH
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(
        ethers.parseEther("0.1"),
      );
    });

    it("should zero out operatorFeesAccrued after withdrawal", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await venue.connect(owner).withdrawOperatorFees();
      expect(await venue.operatorFeesAccrued()).to.equal(0n);
    });

    it("should only distribute investor share after fee deduction", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      // 10% fee → investor gets 90% = 0.9 ETH
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.9"),
      );
    });

    it("should accrue fees across multiple deposits", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      // 10% of 2 ETH = 0.2 ETH accrued
      expect(await venue.operatorFeesAccrued()).to.equal(
        ethers.parseEther("0.2"),
      );
    });

    it("should emit OperatorWithdrawn event", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await expect(venue.connect(owner).withdrawOperatorFees())
        .to.emit(venue, "OperatorWithdrawn")
        .withArgs(owner.address, ethers.parseEther("0.1"));
    });

    it("should revert TransferFailed if ETH transfer to operator fails", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const RejectEther = await ethers.getContractFactory("RejectEther");
      const [, user1] = await ethers.getSigners();

      const fakeOperator = await RejectEther.deploy(ethers.ZeroAddress);
      await fakeOperator.waitForDeployment();

      const venue2 = await VenueFi.deploy(3600, 31536000, ethers.parseEther("0.5"), await fakeOperator.getAddress(), 10n);
      await venue2.waitForDeployment();

      await fakeOperator.setTarget(await venue2.getAddress());

      await venue2.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue2.finalizeFunding();

      // fakeOperator deposits as operator
      await fakeOperator.doDeposit({ value: ethers.parseEther("1") });

      // fakeOperator has no receive() — transfer fails
      await expect(fakeOperator.doWithdraw()).to.be.revertedWithCustomError(
        venue2,
        "TransferFailed",
      );
    });
  });

  describe("Withdraw Capital", function () {
    it("should revert NotOperator if caller is not operator", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue.connect(user1).withdrawCapital(),
      ).to.be.revertedWithCustomError(venue, "NotOperator");
    });

    it("should revert NotActive if not in ACTIVE state", async function () {
      const { venue, owner } = await loadFixture(deployFixture);
      await expect(
        venue.connect(owner).withdrawCapital(),
      ).to.be.revertedWithCustomError(venue, "NotActive");
    });

    it("should revert ZeroValue if currentRaised is zero", async function () {
      const [owner] = await ethers.getSigners();
      const Harness = await ethers.getContractFactory("VenueFiHarness");
      const harness = await Harness.deploy(
  3600,
  31536000,       // operating duration
  ethers.parseEther("1"),
  owner.address,
  10n,
);
      await harness.waitForDeployment();
      await harness.forceActive();
      await expect(
        harness.connect(owner).withdrawCapital(),
      ).to.be.revertedWithCustomError(harness, "ZeroValue");
    });

    it("should transfer currentRaised to operator", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await venue.connect(owner).withdrawCapital();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(
        ethers.parseEther("1"),
      );
    });

    it("should zero out currentRaised after withdrawal", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue.connect(owner).withdrawCapital();
      expect(await venue.currentRaised()).to.equal(0n);
    });

    it("should emit CapitalWithdrawn event", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();

      await expect(venue.connect(owner).withdrawCapital())
        .to.emit(venue, "CapitalWithdrawn")
        .withArgs(owner.address, ethers.parseEther("1"));
    });

    it("should revert TransferFailed if ETH transfer to operator fails", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const RejectEther = await ethers.getContractFactory("RejectEther");
      const [, user1] = await ethers.getSigners();

      const fakeOperator = await RejectEther.deploy(ethers.ZeroAddress);
      await fakeOperator.waitForDeployment();

      const venue2 = await VenueFi.deploy(3600, 31536000, ethers.parseEther("0.5"), await fakeOperator.getAddress(), 10n);
      await venue2.waitForDeployment();

      await fakeOperator.setTarget(await venue2.getAddress());

      await venue2.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue2.finalizeFunding();

      await expect(
        fakeOperator.doWithdrawCapital(),
      ).to.be.revertedWithCustomError(venue2, "TransferFailed");
    });
  });

  describe("Finalize Campaign", function () {
    it("should revert NotActive if not in ACTIVE state", async function () {
      const { venue } = await loadFixture(deployFixture);
      await expect(venue.finalizeCampaign()).to.be.revertedWithCustomError(
        venue,
        "NotActive",
      );
    });

    it("should revert CampaignNotEnded if called before endTime", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(venue.finalizeCampaign()).to.be.revertedWithCustomError(
        venue,
        "CampaignNotEnded",
      );
    });

    it("should revert CampaignNotEnded if operator calls before endTime", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await expect(
        venue.connect(owner).finalizeCampaign(),
      ).to.be.revertedWithCustomError(venue, "CampaignNotEnded");
    });

    it("should allow anyone to finalize after endTime", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const endTime = await venue.endTime();
      await time.increaseTo(endTime + 1n);
      await venue.connect(user2).finalizeCampaign();
      expect(await venue.state()).to.equal(2); // ENDED
    });

    it("should allow operator to finalize after endTime", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const endTime = await venue.endTime();
      await time.increaseTo(endTime + 1n);
      await venue.connect(owner).finalizeCampaign();
      expect(await venue.state()).to.equal(2); // ENDED
    });

    it("should emit StateChanged event", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const endTime = await venue.endTime();
      await time.increaseTo(endTime + 1n);
      await expect(venue.finalizeCampaign())
        .to.emit(venue, "StateChanged")
        .withArgs(2);
    });

    it("should block depositRevenue after finalization", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const endTime = await venue.endTime();
      await time.increaseTo(endTime + 1n);
      await venue.finalizeCampaign();
      await expect(
        venue
          .connect(owner)
          .depositRevenue({ value: ethers.parseEther("0.5") }),
      ).to.be.revertedWithCustomError(venue, "NotActive");
    });
  });

  describe("Claim Revenue after finalization", function () {
    it("should allow claim in ENDED state", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.5") });

      const endTime = await venue.endTime();
      await time.increaseTo(endTime + 1n);
      await venue.finalizeCampaign();

      // user1 should still be able to claim after finalization
      await venue.connect(user1).claimRevenue();
      expect(await venue.pending(user1.address)).to.equal(0n);
    });

    it("should revert NotActive if claim attempted in FUNDING state", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await expect(
        venue.connect(user1).claimRevenue(),
      ).to.be.revertedWithCustomError(venue, "NotActive");
    });
  });
});
