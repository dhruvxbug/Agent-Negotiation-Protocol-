import { ethers } from "ethers";
import { CHAIN_CONFIGS } from "../config";
import { ChainName } from "../types";
import { NegotiationSession } from "../types";
import AgentRegistryABI from "./abis/AgentRegistry.json";
import NegotiationEngineABI from "./abis/NegotiationEngine.json";
import SkillRegistryABI from "./abis/SkillRegistry.json";

export const SESSION_STATUS_MAP: Record<number, string> = {
  0: "OPEN",
  1: "ACTIVE",
  2: "AGREED",
  3: "EXPIRED",
  4: "CANCELLED",
};

export class ContractClient {
  public w3: ethers.JsonRpcProvider;
  public wallet: ethers.Wallet;
  public address: string;
  public chainConfig: (typeof CHAIN_CONFIGS)[keyof typeof CHAIN_CONFIGS];
  public registry: ethers.Contract;
  public engine: ethers.Contract;
  public skills: ethers.Contract;

  constructor(privateKey: string, chain: ChainName = "fuji") {
    this.chainConfig = CHAIN_CONFIGS[chain];
    this.w3 = new ethers.JsonRpcProvider(this.chainConfig.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.w3);
    this.address = this.wallet.address;

    const addrs = this.chainConfig.contracts;
    this.registry = new ethers.Contract(
      addrs.AgentRegistry, AgentRegistryABI, this.wallet
    );
    this.engine = new ethers.Contract(
      addrs.NegotiationEngine, NegotiationEngineABI, this.wallet
    );
    this.skills = new ethers.Contract(
      addrs.SkillRegistry, SkillRegistryABI, this.wallet
    );
  }

  // ── AgentRegistry ────────────────────────────────────────

  async registerAgent(name: string, niche: string): Promise<ethers.ContractTransactionReceipt> {
    const tx = await this.registry.registerAgent(name, niche);
    return tx.wait();
  }

  async isRegistered(address: string): Promise<boolean> {
    return this.registry.isRegistered(address);
  }

  async getReputation(address: string): Promise<number> {
    const rep = await this.registry.getReputationScore(address);
    return Number(rep);
  }

  async getReputationDisplay(address: string): Promise<number> {
    return (await this.getReputation(address)) / 1000;
  }

  async getAgent(address: string): Promise<any> {
    const raw = await this.registry.getAgent(address);
    return {
      wallet: raw.wallet,
      name: raw.name,
      serviceNiche: raw.serviceNiche,
      reputationScore: Number(raw.reputationScore),
      totalRatings: Number(raw.totalRatings),
      dealsCompleted: Number(raw.dealsCompleted),
      dealsAbandoned: Number(raw.dealsAbandoned),
      totalEarnedWei: Number(raw.totalEarnedWei),
      registeredAt: Number(raw.registeredAt),
      isActive: raw.isActive,
    };
  }

  async getAgentsByNiche(niche: string, limit = 10): Promise<string[]> {
    return this.registry.getAgentsByNiche(niche, limit);
  }

  async submitFeedback(
    sessionId: string, rated: string, score: number, onTime: boolean
  ): Promise<ethers.ContractTransactionReceipt> {
    const tx = await this.registry.submitFeedback(sessionId, rated, score, onTime);
    return tx.wait();
  }

  // ── NegotiationEngine ─────────────────────────────────────

  async openSession(
    seller: string, description: string, budgetCapWei: bigint,
    maxRounds: number, durationSeconds: number
  ): Promise<string> {
    const tx = await this.engine.openSession(
      seller, description, budgetCapWei, maxRounds, durationSeconds
    );
    const receipt = await tx.wait();
    const log = receipt.logs.find((l: any) => l.fragment?.name === "SessionOpened");
    if (!log) throw new Error("SessionOpened event not found");
    return log.args.sessionId;
  }

  async submitBuyerBid(sessionId: string, bidWei: bigint): Promise<ethers.ContractTransactionReceipt> {
    const tx = await this.engine.submitBuyerBid(sessionId, bidWei);
    return tx.wait();
  }

  async submitSellerAsk(sessionId: string, askWei: bigint): Promise<ethers.ContractTransactionReceipt> {
    const tx = await this.engine.submitSellerAsk(sessionId, askWei);
    return tx.wait();
  }

  async getSession(sessionId: string): Promise<NegotiationSession> {
    const raw: any = await this.engine.getSession(sessionId);
    return {
      sessionId: raw.sessionId,
      buyer: raw.buyer,
      seller: raw.seller,
      serviceDescription: raw.serviceDescription,
      buyerBudgetCap: Number(raw.buyerBudgetCap),
      currentRound: Number(raw.currentRound),
      maxRounds: Number(raw.maxRounds),
      agreedPrice: Number(raw.agreedPrice),
      deadline: Number(raw.deadline),
      status: SESSION_STATUS_MAP[Number(raw.status)] || "UNKNOWN",
      statusCode: Number(raw.status),
      buyerOffers: Array.from(raw.buyerOffers).map(Number),
      sellerOffers: Array.from(raw.sellerOffers).map(Number),
    };
  }

  async getLatestOffers(sessionId: string): Promise<{ latestBid: number; latestAsk: number; round: number }> {
    const result = await this.engine.getLatestOffers(sessionId);
    return { latestBid: Number(result.latestBid), latestAsk: Number(result.latestAsk), round: Number(result.round) };
  }

  async getOpenSessionsForSeller(seller: string): Promise<string[]> {
    return this.engine.getOpenSessionsForSeller(seller);
  }

  // ── SkillRegistry ─────────────────────────────────────────

  async attestSkill(skillType: number, sdkVersion: string, framework: string): Promise<ethers.ContractTransactionReceipt> {
    const tx = await this.skills.attestSkill(skillType, sdkVersion, framework);
    return tx.wait();
  }

  async hasSkill(agent: string, skillType: number): Promise<boolean> {
    return this.skills.hasSkill(agent, skillType);
  }

  async isFullyCapable(agent: string): Promise<boolean> {
    return this.skills.isFullyCapable(agent);
  }

  async getAgentSkills(agent: string): Promise<number[]> {
    const raw = await this.skills.getAgentSkills(agent);
    return raw.map(Number);
  }

  async attestAllSkills(framework = "raw"): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await this.attestSkill(i, "@agentpact/sdk@0.1.0", framework);
    }
  }
}
