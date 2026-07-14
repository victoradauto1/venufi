const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("VenueFactory", function () {
  // Default params for a valid venue creation
  const VENUE_NAME = "Iron Temple Gym";
  const FUNDING_DURATION = 3600; // 1 hour
  const OPERATING_DURATION = 31536000; // 1 year
  const FUNDING_GOAL = ethers.parseEther("1");
  const OPERATOR_FEE = 10n;

  async function deployFactoryFixture() {
    const [operator, otherUser] = await ethers.getSigners();

    const VenueFactory = await ethers.getContractFactory("VenueFactory");
    const factory = await VenueFactory.deploy();
    await factory.waitForDeployment();

    return { factory, operator, otherUser };
  }

  // ----------------------------------------------------------------
  //  createVenue — Happy Path
  // ----------------------------------------------------------------
  describe("createVenue", function () {
    it("should deploy a new VenueFi and return its address", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      const tx = await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      const receipt = await tx.wait();

      // The returned address must be non-zero
      const venueAddress = await factory.venues(0);
      expect(venueAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should set msg.sender as the operator of the created venue", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      expect(await venue.operator()).to.equal(operator.address);
    });

    it("should emit VenueCreated with correct args", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          OPERATING_DURATION,
          FUNDING_GOAL,
          OPERATOR_FEE,
        ),
      )
        .to.emit(factory, "VenueCreated")
        .withArgs(
          // venue address is dynamic — use anyValue via a predicate
          (addr: string) => addr !== ethers.ZeroAddress,
          operator.address,
          VENUE_NAME,
          FUNDING_GOAL,
          FUNDING_DURATION,
        );
    });

    it("should allow different operators to create venues independently", async function () {
      const { factory, operator, otherUser } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      await factory.connect(otherUser).createVenue(
        "Sunset Lounge",
        7200,
        OPERATING_DURATION,
        ethers.parseEther("2"),
        5n,
      );

      expect(await factory.getVenuesCount()).to.equal(2);
    });

    it("should create a VenueFi in FUNDING state", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      // State.FUNDING == 0
      expect(await venue.state()).to.equal(0);
    });

    it("should pass correct fundingGoal to the child VenueFi", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      expect(await venue.fundingGoal()).to.equal(FUNDING_GOAL);
    });

    it("should pass correct operatorFeePercentage to child VenueFi", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      expect(await venue.operatorFeePercentage()).to.equal(OPERATOR_FEE);
    });

    it("should pass correct venueName to the child VenueFi", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      expect(await venue.venueName()).to.equal(VENUE_NAME);
    });
  });

  // ----------------------------------------------------------------
  //  createVenue — Validations (reverts)
  // ----------------------------------------------------------------
  describe("createVenue validations", function () {
    it("should revert InvalidFundingDuration if _fundingDuration is 0", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          0, // ← invalid
          OPERATING_DURATION,
          FUNDING_GOAL,
          OPERATOR_FEE,
        ),
      ).to.be.revertedWithCustomError(factory, "InvalidFundingDuration");
    });

    it("should revert InvalidOperatingDuration if _operatingDuration is 0", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          0, // ← invalid
          FUNDING_GOAL,
          OPERATOR_FEE,
        ),
      ).to.be.revertedWithCustomError(factory, "InvalidOperatingDuration");
    });

    it("should revert InvalidFundingGoal if _fundingGoal is 0", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          OPERATING_DURATION,
          0, // ← invalid
          OPERATOR_FEE,
        ),
      ).to.be.revertedWithCustomError(factory, "InvalidFundingGoal");
    });

    it("should revert InvalidFee if _operatorFeePercentage > 100", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          OPERATING_DURATION,
          FUNDING_GOAL,
          101, // ← invalid
        ),
      ).to.be.revertedWithCustomError(factory, "InvalidFee");
    });

    it("should accept _operatorFeePercentage = 100 (edge case)", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          OPERATING_DURATION,
          FUNDING_GOAL,
          100, // edge — must NOT revert
        ),
      ).to.not.be.reverted;
    });

    it("should accept _operatorFeePercentage = 0 (no fee)", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(operator).createVenue(
          VENUE_NAME,
          FUNDING_DURATION,
          OPERATING_DURATION,
          FUNDING_GOAL,
          0, // edge — must NOT revert
        ),
      ).to.not.be.reverted;
    });
  });

  // ----------------------------------------------------------------
  //  Registry — venues array
  // ----------------------------------------------------------------
  describe("venues registry", function () {
    it("should start with zero venues", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      expect(await factory.getVenuesCount()).to.equal(0);
    });

    it("should increment venues count after each creation", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      expect(await factory.getVenuesCount()).to.equal(1);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      expect(await factory.getVenuesCount()).to.equal(2);
    });

    it("should store correct venue address at each index", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      const tx1 = await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      const receipt1 = await tx1.wait();

      const tx2 = await factory.connect(operator).createVenue(
        "Sunset Lounge",
        7200,
        OPERATING_DURATION,
        ethers.parseEther("2"),
        5n,
      );
      const receipt2 = await tx2.wait();

      const addr0 = await factory.venues(0);
      const addr1 = await factory.venues(1);

      expect(addr0).to.not.equal(ethers.ZeroAddress);
      expect(addr1).to.not.equal(ethers.ZeroAddress);
      expect(addr0).to.not.equal(addr1);
    });
  });

  // ----------------------------------------------------------------
  //  Registry — venuesByOperator mapping
  // ----------------------------------------------------------------
  describe("venuesByOperator", function () {
    it("should return empty array for operator with no venues", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      const result = await factory.getVenuesByOperator(operator.address);
      expect(result.length).to.equal(0);
    });

    it("should track venues per operator correctly", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      await factory.connect(operator).createVenue(
        "Sunset Lounge",
        7200,
        OPERATING_DURATION,
        ethers.parseEther("5"),
        OPERATOR_FEE,
      );

      const operatorVenues = await factory.getVenuesByOperator(operator.address);
      expect(operatorVenues.length).to.equal(2);
    });

    it("should isolate venues between different operators", async function () {
      const { factory, operator, otherUser } = await loadFixture(deployFactoryFixture);

      // operator creates 2 venues
      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      await factory.connect(operator).createVenue(
        "Iron Temple Gym 2",
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      // otherUser creates 1 venue
      await factory.connect(otherUser).createVenue(
        "Sunset Lounge",
        FUNDING_DURATION,
        OPERATING_DURATION,
        ethers.parseEther("3"),
        5n,
      );

      const opVenues = await factory.getVenuesByOperator(operator.address);
      const otherVenues = await factory.getVenuesByOperator(otherUser.address);

      expect(opVenues.length).to.equal(2);
      expect(otherVenues.length).to.equal(1);

      // global count should be 3
      expect(await factory.getVenuesCount()).to.equal(3);
    });

    it("should return correct addresses in venuesByOperator", async function () {
      const { factory, operator } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const operatorVenues = await factory.getVenuesByOperator(operator.address);
      const globalVenue = await factory.venues(0);

      expect(operatorVenues[0]).to.equal(globalVenue);
    });
  });

  // ----------------------------------------------------------------
  //  View functions
  // ----------------------------------------------------------------
  describe("getVenuesCount", function () {
    it("should return 0 when no venues exist", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      expect(await factory.getVenuesCount()).to.equal(0);
    });

    it("should return correct count after multiple creations", async function () {
      const { factory, operator, otherUser } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      await factory.connect(otherUser).createVenue(
        "Sunset Lounge",
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );
      await factory.connect(operator).createVenue(
        "Iron Temple Gym 2",
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      expect(await factory.getVenuesCount()).to.equal(3);
    });
  });

  // ----------------------------------------------------------------
  //  Integration — child VenueFi is functional
  // ----------------------------------------------------------------
  describe("Integration: child VenueFi works", function () {
    it("should allow investment in a factory-created venue", async function () {
      const { factory, operator, otherUser } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      // otherUser invests in the factory-created venue
      await venue.connect(otherUser).invest({ value: ethers.parseEther("0.5") });

      expect(await venue.totalRaised()).to.equal(ethers.parseEther("0.5"));
      expect(await venue.balance(otherUser.address)).to.equal(ethers.parseEther("0.5"));
    });

    it("should auto-transition to ACTIVE on a factory-created venue when goal is met", async function () {
      const { factory, operator, otherUser } = await loadFixture(deployFactoryFixture);

      await factory.connect(operator).createVenue(
        VENUE_NAME,
        FUNDING_DURATION,
        OPERATING_DURATION,
        FUNDING_GOAL,
        OPERATOR_FEE,
      );

      const venueAddress = await factory.venues(0);
      const VenueFi = await ethers.getContractFactory("VenueFi");
      const venue = VenueFi.attach(venueAddress);

      // Invest enough to meet goal → auto-transition to ACTIVE
      await venue.connect(otherUser).invest({ value: ethers.parseEther("1.5") });

      // State.ACTIVE == 1
      expect(await venue.state()).to.equal(1);
    });
  });
});
