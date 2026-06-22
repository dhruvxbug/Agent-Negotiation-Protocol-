const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying AgentPact contracts to Avalanche Fuji...\n");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "AVAX\n");

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgentRegistry:      ", registryAddr);

  const NegotiationEngine = await hre.ethers.getContractFactory("NegotiationEngine");
  const engine = await NegotiationEngine.deploy();
  await engine.waitForDeployment();
  const engineAddr = await engine.getAddress();
  console.log("NegotiationEngine:  ", engineAddr);

  const SkillRegistry = await hre.ethers.getContractFactory("SkillRegistry");
  const skills = await SkillRegistry.deploy();
  await skills.waitForDeployment();
  const skillsAddr = await skills.getAddress();
  console.log("SkillRegistry:      ", skillsAddr);

  const addresses = {
    chainId: 43113,
    network: "fuji",
    AgentRegistry: registryAddr,
    NegotiationEngine: engineAddr,
    SkillRegistry: skillsAddr,
    deployedAt: new Date().toISOString()
  };

  const outPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses written to deployed-addresses.json");

  console.log("\n=== Add these to root .env ===");
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`NEGOTIATION_ENGINE_ADDRESS=${engineAddr}`);
  console.log(`SKILL_REGISTRY_ADDRESS=${skillsAddr}`);
  console.log(`NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`NEXT_PUBLIC_NEGOTIATION_ENGINE_ADDRESS=${engineAddr}`);
  console.log(`NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS=${skillsAddr}`);
  console.log("===============================\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
