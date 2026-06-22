"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { decimals: 18, name: "Avalanche", symbol: "AVAX" },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc"] },
  },
  blockExplorers: {
    default: { name: "Snowtrace", url: "https://testnet.snowtrace.io" },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "AgentPact",
  projectId: "agentpact-demo",
  chains: [avalancheFuji],
  ssr: true,
});
