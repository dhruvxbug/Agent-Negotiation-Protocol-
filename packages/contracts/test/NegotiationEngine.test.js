const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NegotiationEngine", function () {
  let engine, registry;
  let buyer, seller, other;

  beforeEach(async function () {
    [buyer, seller, other] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    const NegotiationEngine = await ethers.getContractFactory("NegotiationEngine");
    engine = await NegotiationEngine.deploy();
    await engine.waitForDeployment();
  });

  describe("openSession", function () {
    it("creates session with correct fields", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "data analysis",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      );
      expect(event).to.not.be.undefined;

      const sessionId = event.args.sessionId;
      const session = await engine.getSession(sessionId);

      expect(session.buyer).to.equal(buyer.address);
      expect(session.seller).to.equal(seller.address);
      expect(session.serviceDescription).to.equal("data analysis");
      expect(session.maxRounds).to.equal(5);
      expect(session.status).to.equal(0);
    });

    it("rejects if buyer == seller", async function () {
      await expect(
        engine.connect(buyer).openSession(buyer.address, "test", 100, 5, 3600)
      ).to.be.revertedWith("Buyer and seller must differ");
    });

    it("rejects if budget cap is zero", async function () {
      await expect(
        engine.connect(buyer).openSession(seller.address, "test", 0, 5, 3600)
      ).to.be.revertedWith("Budget cap must be positive");
    });

    it("rejects if max rounds out of range", async function () {
      await expect(
        engine.connect(buyer).openSession(seller.address, "test", 100, 0, 3600)
      ).to.be.revertedWith("Max rounds must be 1-10");
      await expect(
        engine.connect(buyer).openSession(seller.address, "test", 100, 11, 3600)
      ).to.be.revertedWith("Max rounds must be 1-10");
    });

    it("rejects if duration too short", async function () {
      await expect(
        engine.connect(buyer).openSession(seller.address, "test", 100, 5, 30)
      ).to.be.revertedWith("Minimum 60 second duration");
    });
  });

  describe("submitSellerAsk", function () {
    let sessionId;

    beforeEach(async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();
      sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;
    });

    it("fails if not seller", async function () {
      await expect(
        engine.connect(other).submitSellerAsk(sessionId, 100)
      ).to.be.revertedWith("Not the seller");
    });

    it("succeeds for seller and transitions to ACTIVE", async function () {
      await engine.connect(seller).submitSellerAsk(sessionId, ethers.parseEther("0.08"));

      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(1);
      expect(session.sellerOffers.length).to.equal(1);
      expect(session.sellerOffers[0]).to.equal(ethers.parseEther("0.08"));
    });

    it("fails if submitting twice in same round", async function () {
      await engine.connect(seller).submitSellerAsk(sessionId, 100);
      await expect(
        engine.connect(seller).submitSellerAsk(sessionId, 90)
      ).to.be.revertedWith("Already submitted this round");
    });
  });

  describe("submitBuyerBid", function () {
    let sessionId;

    beforeEach(async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();
      sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;
      await engine.connect(seller).submitSellerAsk(sessionId, ethers.parseEther("0.08"));
    });

    it("fails if bid exceeds budget cap", async function () {
      await expect(
        engine.connect(buyer).submitBuyerBid(sessionId, ethers.parseEther("0.2"))
      ).to.be.revertedWith("Bid exceeds budget cap");
    });

    it("fails if buyer submits before seller joins (OPEN state)", async function () {
      const tx2 = await engine.connect(buyer).openSession(
        seller.address,
        "test2",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt2 = await tx2.wait();
      const sid2 = receipt2.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await expect(
        engine.connect(buyer).submitBuyerBid(sid2, ethers.parseEther("0.05"))
      ).to.be.revertedWith("Seller must join first");
    });

    it("succeeds with valid bid within budget", async function () {
      await engine.connect(buyer).submitBuyerBid(sessionId, ethers.parseEther("0.05"));

      const session = await engine.getSession(sessionId);
      expect(session.buyerOffers.length).to.equal(1);
      expect(session.buyerOffers[0]).to.equal(ethers.parseEther("0.05"));
    });
  });

  describe("convergence detection", function () {
    it("reaches AGREED when bid >= ask", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();
      const sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await engine.connect(seller).submitSellerAsk(sessionId, ethers.parseEther("0.05"));
      await engine.connect(buyer).submitBuyerBid(sessionId, ethers.parseEther("0.06"));

      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(2);
      expect(session.agreedPrice).to.equal(ethers.parseEther("0.055"));
    });

    it("emits DealReached event on convergence", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();
      const sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await engine.connect(seller).submitSellerAsk(sessionId, ethers.parseEther("0.05"));

      await expect(
        engine.connect(buyer).submitBuyerBid(sessionId, ethers.parseEther("0.06"))
      ).to.emit(engine, "DealReached");
    });
  });

  describe("cancelSession", function () {
    let sessionId;

    beforeEach(async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        3600
      );
      const receipt = await tx.wait();
      sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;
    });

    it("buyer can cancel", async function () {
      await engine.connect(buyer).cancelSession(sessionId);
      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(4);
    });

    it("seller can cancel", async function () {
      await engine.connect(seller).cancelSession(sessionId);
      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(4);
    });

    it("third party cannot cancel", async function () {
      await expect(
        engine.connect(other).cancelSession(sessionId)
      ).to.be.revertedWith("Only buyer or seller can cancel");
    });
  });

  describe("expireSession", function () {
    it("only callable after deadline", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("0.1"),
        5,
        60
      );
      const receipt = await tx.wait();
      const sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await expect(
        engine.connect(buyer).expireSession(sessionId)
      ).to.be.revertedWith("Session not yet expired");

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine");

      await engine.connect(buyer).expireSession(sessionId);
      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(3);
    });
  });

  describe("max rounds exhaustion", function () {
    it("expires after max rounds with no convergence", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        ethers.parseEther("1"),
        2,
        3600
      );
      const receipt = await tx.wait();
      const sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await engine.connect(seller).submitSellerAsk(sessionId, 100);
      await engine.connect(buyer).submitBuyerBid(sessionId, 10);

      await engine.connect(seller).submitSellerAsk(sessionId, 90);
      await engine.connect(buyer).submitBuyerBid(sessionId, 20);

      const session = await engine.getSession(sessionId);
      expect(session.status).to.equal(3);
    });
  });

  describe("full negotiation simulation", function () {
    it("3-round convergence: bid and ask meet at round 3", async function () {
      const tx = await engine.connect(buyer).openSession(
        seller.address,
        "test",
        100,
        4,
        3600
      );
      const receipt = await tx.wait();
      const sessionId = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "SessionOpened"
      ).args.sessionId;

      await engine.connect(seller).submitSellerAsk(sessionId, 100);
      await engine.connect(buyer).submitBuyerBid(sessionId, 20);
      let s = await engine.getSession(sessionId);
      expect(s.status).to.equal(1);
      expect(s.currentRound).to.equal(1);

      await engine.connect(seller).submitSellerAsk(sessionId, 85);
      await engine.connect(buyer).submitBuyerBid(sessionId, 40);
      s = await engine.getSession(sessionId);
      expect(s.currentRound).to.equal(2);

      await engine.connect(seller).submitSellerAsk(sessionId, 73);
      await engine.connect(buyer).submitBuyerBid(sessionId, 58);
      s = await engine.getSession(sessionId);
      expect(s.currentRound).to.equal(3);

      await engine.connect(seller).submitSellerAsk(sessionId, 65);

      await expect(
        engine.connect(buyer).submitBuyerBid(sessionId, 65)
      ).to.emit(engine, "DealReached");

      s = await engine.getSession(sessionId);
      expect(s.status).to.equal(2);
      expect(s.agreedPrice).to.equal(65);
    });
  });
});
