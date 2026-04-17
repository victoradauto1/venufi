const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VenueFi", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const VenueFi = await ethers.getContractFactory("VenueFi");
    const venue = await VenueFi.deploy(3600); // 1h deadline

    await venue.waitForDeployment();

    return { venue, owner, user1, user2 };
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
      const investmentAmount = ethers.parseEther("0.1");
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
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      await venue.closeFunding(); // precisa existir no contrato
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "NotFunding");
    });

    it("should revert FundingEnded", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n); // avança o tempo além do deadline
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "FundingEnded");
    });
  });
});
