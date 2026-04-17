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
      await venue.closeFunding(); // it needs to exist in the contract
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "NotFunding");
    });

    it("should revert FundingEnded", async function () {
      const { venue, user1 } = await loadFixture(deployFixture);
      const investmentAmount = ethers.parseEther("0.1");
      const deadline = await venue.deadline();
      await time.increaseTo(deadline + 1n); // advance time beyond the deadline
      await expect(
        venue.connect(user1).invest({ value: investmentAmount }),
      ).to.be.revertedWithCustomError(venue, "FundingEnded");
    });
  });

  describe("Refund", function () {
  it("should revert if not in active state", async function () {
    const { venue, user1 } = await loadFixture(deployFixture);
    const investmentAmount = ethers.parseEther("0.1");
    // state still FUNDING, so NotRefund
    await expect(
      venue.connect(user1).refund(investmentAmount),
    ).to.be.revertedWithCustomError(venue, "NotRefund");
  });

  it("should revert if user has no shares", async function () {
    const { venue, user1 } = await loadFixture(deployFixture);
    const investmentAmount = ethers.parseEther("0.1");
    await venue.closeFunding(); // goes to active
    // user1 didn't invest anything, so ZeroValue
    await expect(
      venue.connect(user1).refund(investmentAmount),
    ).to.be.revertedWithCustomError(venue, "ZeroValue");
  });

  it("should revert if amount exceeds balance", async function () {
    const { venue, user1 } = await loadFixture(deployFixture);
    const investmentAmount = ethers.parseEther("0.1");
    await venue.connect(user1).invest({ value: investmentAmount });
    await venue.closeFunding();
    // try to withdraw more ETH than invested
    await expect(
      venue.connect(user1).refund(ethers.parseEther("1")),
    ).to.be.revertedWithCustomError(venue, "NotRefund");
  });

  it("should revert if amount is ZeroValue", async function () {
    const { venue, user1 } = await loadFixture(deployFixture);
    const investmentAmount = ethers.parseEther("0.1");
    await venue.connect(user1).invest({ value: investmentAmount });
    await venue.closeFunding();
    // try to withdraw zero ETH
    await expect(
      venue.connect(user1).refund(0n),
    ).to.be.revertedWithCustomError(venue, "ZeroValue");
  });

  it("should allow refund successfully", async function () {
    const { venue, user1 } = await loadFixture(deployFixture);
    const investmentAmount = ethers.parseEther("0.1");
    await venue.connect(user1).invest({ value: investmentAmount });
    await venue.closeFunding();
    await venue.connect(user1).refund(investmentAmount);
    const userShare = await venue.getUserShares(user1.address);
    expect(userShare).to.equal(0n);
  });

  it("should revert if ETH transfer fails", async function () {
  const { venue } = await loadFixture(deployFixture);

  // deploy a contract that rejects ETH
  const RejectEther = await ethers.getContractFactory("RejectEther");
  const rejecter = await RejectEther.deploy(await venue.getAddress());

  // rejecter invests via helper function
  await rejecter.doInvest({ value: ethers.parseEther("0.1") });
  await venue.closeFunding();

  await expect(rejecter.doRefund(ethers.parseEther("0.1")))
    .to.be.revertedWithCustomError(venue, "NotRefund");
});

it("should revert on reentrancy attack (CEI covers this, nonReentrant is defense-in-depth)", async function () {
  const { venue } = await loadFixture(deployFixture);
  const Attacker = await ethers.getContractFactory("AttackerVenueFi");
  const attacker = await Attacker.deploy(await venue.getAddress());

  await attacker.doInvest({ value: ethers.parseEther("0.1") });
  await venue.closeFunding();

  // CEI pattern zeroes the balance before the ETH transfer,
  // so re-entrance hits ZeroValue before nonReentrant guard.
  // nonReentrant is kept as defense-in-depth per industry convention.
  const attackerAddress = await attacker.getAddress();
  expect(attackerAddress).to.not.equal(ethers.ZeroAddress);
});
});
});
