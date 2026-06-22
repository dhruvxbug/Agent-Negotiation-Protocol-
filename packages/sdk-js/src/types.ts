export interface AgentProfile {
  address: string;
  name: string;
  niche: string;
  reputation: number;
  dealsCompleted: number;
  isFullyCapable: boolean;
}

export interface NegotiationSession {
  sessionId: string;
  buyer: string;
  seller: string;
  serviceDescription: string;
  buyerBudgetCap: number;
  currentRound: number;
  maxRounds: number;
  agreedPrice: number;
  deadline: number;
  status: string;
  statusCode: number;
  buyerOffers: number[];
  sellerOffers: number[];
}

export interface HireResult {
  session: NegotiationSession;
  content: any;
  agreedPriceUsdc: number;
}

export type ChainName = "fuji" | "hardhat";

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  name: string;
  explorer: string;
  contracts: {
    AgentRegistry: string;
    NegotiationEngine: string;
    SkillRegistry: string;
  };
}
