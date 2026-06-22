import { ContractClient } from "./contracts/client";
import { IdentitySkill } from "./core/identity";
import { NegotiationSkill } from "./core/negotiation";
import { X402Client } from "./core/payment";
import { StrategyEngine } from "./core/strategy";
import { AgentProfile, HireResult, ChainName } from "./types";

export class AgentSDK {
  public contractClient: ContractClient;
  public address: string;
  public strategy: StrategyEngine;
  public identity: IdentitySkill;
  public negotiation: NegotiationSkill;
  public x402Client: X402Client;
  private agreedPriceWei: bigint | null = null;

  constructor(privateKey: string, chain: ChainName = "fuji", llmApiKey?: string) {
    this.contractClient = new ContractClient(privateKey, chain);
    this.address = this.contractClient.address;
    this.strategy = new StrategyEngine(llmApiKey);
    this.identity = new IdentitySkill(this.contractClient);
    this.negotiation = new NegotiationSkill(this.contractClient, this.strategy);
    this.x402Client = new X402Client(this.contractClient);
  }

  async setup(name: string, niche: string, framework = "raw"): Promise<AgentSDK> {
    const registered = await this.identity.ensureRegistered(name, niche);
    if (registered) console.log(`[AgentSDK] Registered as '${name}' in niche '${niche}'`);
    await this.identity.ensureSkillsAttested(framework);
    console.log(`[AgentSDK] Ready. Address: ${this.address}`);
    return this;
  }

  async hire(params: {
    service: string;
    niche: string;
    maxPriceUsdc: number;
    minReputation?: number;
    sellerAddress?: string;
  }): Promise<HireResult> {
    const { service, niche, maxPriceUsdc, minReputation = 5.0, sellerAddress } = params;
    let sellerAddr: string;
    let sellerRep = 0;

    if (sellerAddress) {
      sellerAddr = sellerAddress;
      sellerRep = await this.contractClient.getReputationDisplay(sellerAddr);
    } else {
      const sellers = await this.identity.findSellers(niche, minReputation);
      if (!sellers.length) throw new Error(`No qualified sellers found in niche: ${niche}`);
      sellerAddr = sellers[0].address;
      sellerRep = sellers[0].reputation;
      console.log(`[AgentSDK] Selected seller ${sellerAddr.slice(0, 10)}... rep=${sellerRep.toFixed(1)}/10`);
    }

    const sellerProfile = await this.contractClient.getAgent(sellerAddr);
    let endpoint = "http://localhost:5001/service";
    if (sellerProfile.name && sellerProfile.name.includes("|")) {
      endpoint = sellerProfile.name.split("|")[1];
    }

    const sessionId = await this.negotiation.openSession(sellerAddr, service, maxPriceUsdc);

    let resultSession: any = {};
    let serviceContent: any = {};

    const onDeal = async (session: any) => {
      resultSession = session;
      this.agreedPriceWei = session.agreedPrice;
      serviceContent = await this.x402Client.requestService(endpoint, session.agreedPrice);
      await this.contractClient.submitFeedback(session.sessionId, sellerAddr, 5, true);
    };

    await this.negotiation.runBuyerLoop(
      sessionId, maxPriceUsdc, sellerRep, service, onDeal
    );

    return {
      session: resultSession,
      content: serviceContent,
      agreedPriceUsdc: NegotiationSkill.weiToUsdc(resultSession.agreedPrice || 0),
    };
  }

  async listAsSeller(serviceContent: any, floorPriceUsdc: number, port = 5001): Promise<void> {
    console.log(`[AgentSDK] Seller mode — would start x402 server on port ${port}`);
    console.log("[AgentSDK] Use Python SDK for full seller loop with x402 server");
  }

  async profile(): Promise<AgentProfile> {
    return this.identity.getProfile();
  }

  async reputation(): Promise<number> {
    return this.contractClient.getReputationDisplay(this.address);
  }
}
