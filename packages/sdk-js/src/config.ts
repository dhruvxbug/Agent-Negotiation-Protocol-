import { ChainConfig, ChainName } from "./types";

const FUJI_RPC = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

export const CHAIN_CONFIGS: Record<ChainName, ChainConfig> = {
  fuji: {
    rpcUrl: FUJI_RPC,
    chainId: 43113,
    name: "Avalanche Fuji",
    explorer: "https://testnet.snowtrace.io",
    contracts: {
      AgentRegistry: process.env.AGENT_REGISTRY_ADDRESS || "",
      NegotiationEngine: process.env.NEGOTIATION_ENGINE_ADDRESS || "",
      SkillRegistry: process.env.SKILL_REGISTRY_ADDRESS || "",
    },
  },
  hardhat: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    name: "Hardhat Local",
    explorer: "",
    contracts: {
      AgentRegistry: "",
      NegotiationEngine: "",
      SkillRegistry: "",
    },
  },
};

export const SDK_VERSION = "@agentpact/sdk@0.1.0";

export const NEGOTIATION_DEFAULTS = {
  maxRounds: 5,
  pollIntervalMs: 8000,
  durationSeconds: 600,
};
