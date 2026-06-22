import { ethers } from "ethers";
import AgentRegistryABI from "../abis/AgentRegistry.json";
import NegotiationEngineABI from "../abis/NegotiationEngine.json";
import SkillRegistryABI from "../abis/SkillRegistry.json";

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_FUJI_RPC_URL!);
}

export function getRegistryContract() {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS!,
    AgentRegistryABI,
    getProvider()
  );
}

export function getEngineContract() {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_NEGOTIATION_ENGINE_ADDRESS!,
    NegotiationEngineABI,
    getProvider()
  );
}

export function getSkillsContract() {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS!,
    SkillRegistryABI,
    getProvider()
  );
}

export async function getAgent(address: string) {
  const contract = getRegistryContract();
  const data = await contract.getAgent(address);
  return { ...data, reputationDisplay: Number(data.reputationScore) / 1000 };
}

export async function getSession(sessionId: string) {
  const contract = getEngineContract();
  const data = await contract.getSession(sessionId);
  return {
    sessionId: data[0],
    buyer: data[1],
    seller: data[2],
    serviceDescription: data[3],
    buyerBudgetCap: data[4],
    currentRound: Number(data[5]),
    maxRounds: Number(data[6]),
    agreedPrice: data[7],
    deadline: Number(data[8]),
    status: ["OPEN", "ACTIVE", "AGREED", "EXPIRED", "CANCELLED"][Number(data[9])],
    buyerOffers: Array.from(data[10]).map(Number),
    sellerOffers: Array.from(data[11]).map(Number),
  };
}

export async function getRecentDeals(limit = 5) {
  const contract = getEngineContract();
  const filter = contract.filters.DealReached();
  const events = await contract.queryFilter(filter, -10000, "latest");
  return events.slice(-limit).map((e: any) => ({
    sessionId: e.args.sessionId,
    agreedPrice: Number(e.args.agreedPrice),
    buyer: e.args.buyer,
    seller: e.args.seller,
  }));
}

export function weiToUsdc(wei: bigint | number): number {
  return Number(ethers.formatEther(wei)) * 1000;
}
