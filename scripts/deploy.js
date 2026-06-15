const hre = require("hardhat");

async function main() {
  console.log("Deploying to Avalanche Fuji...");

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AgentRegistry deployed to:", registryAddress);

  const NegotiationEngine = await hre.ethers.getContractFactory("NegotiationEngine");
  const engine = await NegotiationEngine.deploy();
  await engine.waitForDeployment();
  const engineAddress = await engine.getAddress();
  console.log("NegotiationEngine deployed to:", engineAddress);

  console.log("\n=== Add these to your .env ===");
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`NEGOTIATION_ENGINE_ADDRESS=${engineAddress}`);
  console.log("==============================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
