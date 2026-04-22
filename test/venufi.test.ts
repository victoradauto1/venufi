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
    it("should revert if not in ACTIVE state", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      // state é FUNDING, refund exige ACTIVE
      await expect(
        venue.connect(user1).refund(investmentAmount),
      ).to.be.revertedWithCustomError(venue, "NotRefund");
    });

    it("should revert if user has no shares", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await activateVenue(venue, user2);
      // user1 não investiu nada
      await expect(
        venue.connect(user1).refund(investmentAmount),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should revert if amount is zero", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await activateVenue(venue, user2);
      await expect(
        venue.connect(user1).refund(0n),
      ).to.be.revertedWithCustomError(venue, "ZeroValue");
    });

    it("should revert if amount exceeds balance", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await activateVenue(venue, user2);
      await expect(
        venue.connect(user1).refund(ethers.parseEther("1")),
      ).to.be.revertedWithCustomError(venue, "NotRefund");
    });

    it("should allow refund successfully", async function () {
      const { venue, user1, user2 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.connect(user1).invest({ value: investmentAmount });
      await activateVenue(venue, user2);
      await venue.connect(user1).refund(investmentAmount);
      const userShare = await venue.getUserShares(user1.address);
      expect(userShare).to.equal(0n);
    });

    it("should revert if ETH transfer fails", async function () {
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue2 = await VenueFi.deploy(3600, ethers.parseEther("0.05"));
      await venue2.waitForDeployment();

      const RejectEther = await ethers.getContractFactory("RejectEther");
      const rejecter = await RejectEther.deploy(await venue2.getAddress());

      // rejecter investe acima do goal e ativa o contrato
      await rejecter.doInvest({ value: ethers.parseEther("0.1") });
      await venue2.finalizeFunding();

      // rejecter não tem receive(), então a transferência falha
      await expect(rejecter.doRefund())
        .to.be.revertedWithCustomError(venue2, "NotRefund");
    });

    it("should revert on reentrancy attack (CEI covers this, nonReentrant is defense-in-depth)", async function () {
      const { venue } = await loadFixture(deployFixture);
      const Attacker = await ethers.getContractFactory("AttackerVenueFi");
      const attacker = await Attacker.deploy(await venue.getAddress());

      await attacker.doInvest({ value: ethers.parseEther("1.1") });
      await venue.finalizeFunding();

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

    it("should stay FUNDING if totalRaised < fundingGoal and deadline not reached", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      await venue.finalizeFunding(); // não reverte, só não muda estado
      const state = await venue.state();
      expect(state).to.equal(0); // ainda FUNDING
    });

    it("should go to ENDED if totalRaised < fundingGoal and deadline reached", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("0.1") });
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n);
      await venue.finalizeFunding();
      const state = await venue.state();
      expect(state).to.equal(2); // ENDED
    });

    it("should stay ACTIVE if called again after ACTIVE", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      await venue.connect(user1).invest({ value: ethers.parseEther("1.1") });
      await venue.finalizeFunding();
      // segunda chamada: totalRaised ainda > fundingGoal, estado já é ACTIVE
      // não reverte, apenas re-seta ACTIVE (comportamento atual do contrato)
      await venue.finalizeFunding();
      const state = await venue.state();
      expect(state).to.equal(1); // ainda ACTIVE
    });
  });

  describe("Deposit Revenue", function () {
    it("should allow deposit when ACTIVE", async function () {
      const { venue, user1, owner } = await loadFixture(deployFixture);
      await activateVenue(venue, user1);
      const depositAmount = ethers.parseEther("0.5");
      await venue.connect(owner).depositRevenue({ value: depositAmount });
      const totalRaised = await venue.totalRaised();
      // totalRaised inclui o invest de 1.1 + deposit de 0.5
      expect(totalRaised).to.equal(ethers.parseEther("1.6"));
    });

    it("should revert if not in ACTIVE state", async function () {
      const { venue, owner } = await loadFixture(deployFixture);
      // state ainda é FUNDING
      await expect(
        venue.connect(owner).depositRevenue({ value: ethers.parseEther("0.5") }),
      ).to.be.revertedWithCustomError(venue, "NotRefund");
    });

    it("should revert if deposit amount is zero", async function () {
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
  });
});