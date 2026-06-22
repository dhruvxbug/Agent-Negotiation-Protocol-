const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentRegistry", function () {
  let registry, buyer, seller, other;

  beforeEach(async function () {
    [buyer, seller, other] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("registration creates agent with 5000 rep score", async function () {
    await registry.connect(buyer).registerAgent("Buyer-Alpha", "data-analysis");
    const agent = await registry.getAgent(buyer.address);
    expect(agent.name).to.equal("Buyer-Alpha");
    expect(agent.serviceNiche).to.equal("data-analysis");
    expect(agent.reputationScore).to.equal(5000);
    expect(agent.isActive).to.equal(true);
    const rep = await registry.getReputationScore(buyer.address);
    expect(rep).to.equal(5000);
  });

  it("duplicate registration reverts", async function () {
    await registry.connect(buyer).registerAgent("Buyer-Alpha", "data-analysis");
    await expect(
      registry.connect(buyer).registerAgent("Buyer-Alpha-2", "content")
    ).to.be.revertedWith("Already registered");
  });

  it("feedback updates reputation correctly (80/20 weighted average)", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await registry.connect(seller).registerAgent("Seller", "data-analysis");

    const sessionId = ethers.randomBytes(32);

    await registry.connect(seller).submitFeedback(sessionId, buyer.address, 5, true);
    let agent = await registry.getAgent(buyer.address);
    // 5000 * 0.8 + (5*2000) * 0.2 = 4000 + 2000 = 6000
    expect(agent.reputationScore).to.equal(6000);
    expect(agent.totalRatings).to.equal(1);

    const seshId2 = ethers.randomBytes(32);
    await registry.connect(seller).submitFeedback(seshId2, buyer.address, 3, true);
    agent = await registry.getAgent(buyer.address);
    // 6000 * 0.8 + (3*2000) * 0.2 = 4800 + 1200 = 6000
    expect(agent.reputationScore).to.equal(6000);
    expect(agent.totalRatings).to.equal(2);
  });

  it("niche query returns correct agents", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await registry.connect(seller).registerAgent("Seller", "content");
    await registry.connect(other).registerAgent("Other", "data-analysis");

    const dataAgents = await registry.getAgentsByNiche("data-analysis", 10);
    expect(dataAgents.length).to.equal(2);

    const contentAgents = await registry.getAgentsByNiche("content", 10);
    expect(contentAgents.length).to.equal(1);
  });

  it("duplicate feedback for same session reverts", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await registry.connect(seller).registerAgent("Seller", "data-analysis");
    const sessionId = ethers.randomBytes(32);
    await registry.connect(seller).submitFeedback(sessionId, buyer.address, 5, true);
    await expect(
      registry.connect(seller).submitFeedback(sessionId, buyer.address, 3, true)
    ).to.be.revertedWith("Already rated this session");
  });

  it("unregistered caller cannot record deal completion", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await expect(
      registry.connect(buyer).recordDealCompleted(seller.address, 100)
    ).to.be.revertedWith("Agent not registered");
  });

  it("unregistered caller cannot record deal abandoned", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await expect(
      registry.connect(buyer).recordDealAbandoned(seller.address)
    ).to.be.revertedWith("Agent not registered");
  });

  it("self-rating reverts", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    const sessionId = ethers.randomBytes(32);
    await expect(
      registry.connect(buyer).submitFeedback(sessionId, buyer.address, 5, true)
    ).to.be.revertedWith("Cannot rate yourself");
  });

  it("records deal completed and updates stats", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await registry.recordDealCompleted(buyer.address, ethers.parseEther("0.05"));
    const agent = await registry.getAgent(buyer.address);
    expect(agent.dealsCompleted).to.equal(1);
    expect(agent.totalEarnedWei).to.equal(ethers.parseEther("0.05"));
  });

  it("records deal abandoned and applies reputation penalty", async function () {
    await registry.connect(buyer).registerAgent("Buyer", "data-analysis");
    await registry.recordDealAbandoned(buyer.address);
    const agent = await registry.getAgent(buyer.address);
    expect(agent.dealsAbandoned).to.equal(1);
    expect(agent.reputationScore).to.equal(4900);
  });
});
