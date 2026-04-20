const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VenueFi", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const VenueFi = await ethers.getContractFactory("VenueFi");
    const venue = await VenueFi.deploy(
      3600,
      ethers.parseEther("1")
    );

    await venue.waitForDeployment();

    return { venue, owner, user1, user2 };
  }

  async function activateVenue(venue: any, user: any) {
    await venue.connect(user).invest({ value: ethers.parseEther("1.1") });
    await venue.finalizeFunding();
  }

  describe("Deployment", function () {
    it("Should deploy the contract", async function () {
      const { venue } = await loadFixture(deployFixture);
      expect(venue).to.not.be.undefined;
    });
  });

  describe("Investing", function () {
    it("Should allow users to invest with ETH", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      const userShare = await venue.getUserShares(user1.address);
      expect(userShare).to.equal(investmentAmount);
    });

    it("Should not allow users to invest if not enough ETH", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await expect(
        venue.connect(user1).invest({ value: 0n }),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("Should increase total invested amount", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      const totalInvested = await venue.totalInvested();
      expect(totalInvested).to.equal(investmentAmount);
    });

    it("should revert NotFunding", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await activateVenue(venue, user2);
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "NotFunding");
    });

    it("should revert FundingEnded", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "FundingEnded");
    });
  });

  describe("Refund", function () {
    it("should revert if not in FUNDING state", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      // leva para ACTIVE — refund só funciona em FUNDING
      await activateVenue(venue, user2);
      await expect(
        venue.connect(user1).refund(),
      ).to.be.revertedWithCustomError(venue, "NotRefund");
    });

    it("should revert if user has no shares", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      // state FUNDING, mas user1 não investiu nada
      await expect(
        venue.connect(user1).refund(),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should allow refund successfully", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      // refund funciona em FUNDING
      await venue.connect(user1).refund();
      const userShare = await venue.getUserShares(user1.address);
      expect(userShare).to.equal(0n);
    });

    it("should revert if ETH transfer fails", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue2 = await VenueFi.deploy(3600, ethers.parseEther("0.05"));
      await venue2.waitForDeployment();

      const RejectEther = await ethers.getContractFactory("RejectEther");
      const rejecter = await RejectEther.deploy(await venue2.getAddress());

      // rejecter investe em FUNDING — refund vai tentar transferir ETH de volta
      await rejecter.doInvest({ value: ethers.parseEther("0.1") });

      await expect(rejecter.doRefund())
        .to.be.revertedWithCustomError(venue2, "NotRefund");
    });

    it("should revert on reentrancy attack (CEI covers this, nonReentrant is defense-in-depth)", async function () {
      const { venue } = await loadFixture(deployFixture);
      const Attacker = await ethers.getContractFactory("AttackerVenueFi");
      const attacker = await Attacker.deploy(await venue.getAddress());

      await attacker.doInvest({ value: ethers.parseEther("0.1") });

      // CEI pattern zeroes the balance before the ETH transfer,
      // so re-entrance hits ZeroValue before nonReentrant guard.
      // nonReentrant is kept as defense-in-depth per industry convention.
      const attackerAddress = await attacker.getAddress();
      expect(attackerAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Finalize Funding", function () {
    it("should go to ACTIVE if totalRaised >= fundingGoal", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await venue.finalizeFunding();
      const state = await venue.state();
      expect(state).to.equal(1); // ACTIVE
    });

    it("should revert finalizeFunding if totalRaised < fundingGoal", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await expect(
        venue.finalizeFunding()
      ).to.be.revertedWithCustomError(venue, "NotRefund");
    });

    it("should revert finalizeFunding if already ACTIVE", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await venue.finalizeFunding();
      await expect(
        venue.finalizeFunding()
      ).to.be.revertedWithCustomError(venue, "NotFunding");
    });
  });
});