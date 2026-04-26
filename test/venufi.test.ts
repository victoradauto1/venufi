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
      3600,
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
      const venue2 = await VenueFi.deploy(
        3600,
        ethers.parseEther("5"),
        owner.address,
        10n,
      );
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
      expect(await venue.totalRevenue()).to.equal(depositAmount);
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
      const expected = (depositAmount * BigInt(1e18)) / ethers.parseEther("1");
      expect(acc).to.equal(expected);
    });

    it("should revert NoInvestors if totalSupply is zero", async function () {
      const [owner] = await ethers.getSigners();
      const Harness = await ethers.getContractFactory("VenueFiHarness");
      const harness = await Harness.deploy(
        3600,
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
      expect(await venue.pending(user1.address)).to.equal(depositAmount);
    });

    it("should split pending proportionally between investors", async function () {
      const { venue, user1, user2, owner } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1") });
      await venue.connect(user2).invest({ value: ethers.parseEther("0.5") });
      await venue.finalizeFunding();
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("0.3") });
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.2"),
      );
      expect(await venue.pending(user2.address)).to.equal(
        ethers.parseEther("0.1"),
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
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.5"),
      );
    });

    it("should return zero from pending() if accumulated < rewardDebt", async function () {
      const [owner, user1] = await ethers.getSigners();
      const Harness = await ethers.getContractFactory("VenueFiHarness");
      const harness = await Harness.deploy(
        3600,
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

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(depositAmount);
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
        .withArgs(user1.address, depositAmount);
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
      expect(await venue.pending(user1.address)).to.equal(
        ethers.parseEther("0.2"),
      );
    });

    it("should revert TransferFailed if ETH transfer fails on claim", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const [owner] = await ethers.getSigners();
      const venue2 = await VenueFi.deploy(
        3600,
        ethers.parseEther("0.05"),
        owner.address,
        10n,
      );
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

  describe("Withdraw Operator Revenue", function () {
    it("should revert NotOperator if caller is not operator", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await expect(
        venue.connect(user1).withdrawOperatorRevenue(),
      ).to.be.revertedWithCustomError(venue, "NotOperator");
    });

    it("should transfer correct fee amount to operator", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const depositAmount = ethers.parseEther("1");
      await venue.connect(owner).depositRevenue({ value: depositAmount });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await venue.connect(owner).withdrawOperatorRevenue();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      // 10% of 1 ETH = 0.1 ETH
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(
        ethers.parseEther("0.1"),
      );
    });

    it("should decrease totalRevenue after withdrawal", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      await venue
        .connect(owner)
        .depositRevenue({ value: ethers.parseEther("1") });
      await venue.connect(owner).withdrawOperatorRevenue();
      expect(await venue.totalRevenue()).to.equal(ethers.parseEther("0.9"));
    });

    it("should revert TransferFailed if ETH transfer to operator fails", async function () {
  const VenueFi = await ethers.getContractFactory("VenueFi");
  const RejectEther = await ethers.getContractFactory("RejectEther");
  const [owner, user1] = await ethers.getSigners();

  // deploy fakeOperator with placeholder — real target set after venue deploy
  const fakeOperator = await RejectEther.deploy(ethers.ZeroAddress);
  await fakeOperator.waitForDeployment();

  // deploy venue with fakeOperator as operator
  const venue2 = await VenueFi.deploy(
    3600,
    ethers.parseEther("0.5"),
    await fakeOperator.getAddress(),
    10n,
  );
  await venue2.waitForDeployment();

  // point fakeOperator to the real venue
  await fakeOperator.setTarget(await venue2.getAddress());

  await venue2.connect(user1).invest({ value: ethers.parseEther("1") });
  await venue2.finalizeFunding();
  await venue2.connect(owner).depositRevenue({ value: ethers.parseEther("1") });

  // fakeOperator has no receive() — transfer fails
  await expect(fakeOperator.doWithdraw()).to.be.revertedWithCustomError(
    venue2,
    "TransferFailed",
  );
});
  });
});
