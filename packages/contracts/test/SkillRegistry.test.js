const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SkillRegistry", function () {
  let registry, alice, bob;

  beforeEach(async function () {
    [alice, bob] = await ethers.getSigners();
    const SkillRegistry = await ethers.getContractFactory("SkillRegistry");
    registry = await SkillRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("attestSkill stores correct fields", async function () {
    const tx = await registry.connect(alice).attestSkill(0, "anp-sdk@0.1.0", "raw");
    await tx.wait();

    const has = await registry.hasSkill(alice.address, 0);
    expect(has).to.equal(true);

    const attestation = await registry.getAttestation(alice.address, 0);
    expect(attestation.sdkVersion).to.equal("anp-sdk@0.1.0");
    expect(attestation.framework).to.equal("raw");
    expect(attestation.isActive).to.equal(true);
  });

  it("hasSkill returns true/false correctly", async function () {
    await registry.connect(alice).attestSkill(1, "anp-sdk@0.1.0", "raw");
    expect(await registry.hasSkill(alice.address, 1)).to.equal(true);
    expect(await registry.hasSkill(alice.address, 2)).to.equal(false);
    expect(await registry.hasSkill(bob.address, 1)).to.equal(false);
  });

  it("revokeSkill disables attestation", async function () {
    await registry.connect(alice).attestSkill(0, "anp-sdk@0.1.0", "raw");
    await registry.connect(alice).revokeSkill(0);
    const has = await registry.hasSkill(alice.address, 0);
    expect(has).to.equal(false);
  });

  it("isFullyCapable requires all 5 skills", async function () {
    expect(await registry.isFullyCapable(alice.address)).to.equal(false);

    for (let i = 0; i < 5; i++) {
      await registry.connect(alice).attestSkill(i, "anp-sdk@0.1.0", "raw");
    }

    expect(await registry.isFullyCapable(alice.address)).to.equal(true);
  });

  it("getSkillHolders returns correct list", async function () {
    await registry.connect(alice).attestSkill(2, "anp-sdk@0.1.0", "raw");
    await registry.connect(bob).attestSkill(2, "anp-sdk@0.1.0", "crewai");

    const holders = await registry.getSkillHolders(2);
    expect(holders.length).to.equal(2);
    expect(holders[0]).to.equal(alice.address);
    expect(holders[1]).to.equal(bob.address);
  });

  it("getAgentSkills returns all attested skills", async function () {
    await registry.connect(alice).attestSkill(0, "sdk-v1", "raw");
    await registry.connect(alice).attestSkill(4, "sdk-v1", "raw");

    const skills = await registry.getAgentSkills(alice.address);
    expect(skills.length).to.equal(2);
    expect(Number(skills[0])).to.equal(0);
    expect(Number(skills[1])).to.equal(4);
  });

  it("invalid skill type reverts", async function () {
    await expect(
      registry.connect(alice).attestSkill(5, "anp-sdk@0.1.0", "raw")
    ).to.be.reverted;
  });

  it("duplicate attestation does not duplicate index entries", async function () {
    await registry.connect(alice).attestSkill(0, "v1", "raw");
    await registry.connect(alice).attestSkill(0, "v1", "raw");

    const skills = await registry.getAgentSkills(alice.address);
    expect(skills.length).to.equal(1);

    const holders = await registry.getSkillHolders(0);
    expect(holders.length).to.equal(1);
  });
});
