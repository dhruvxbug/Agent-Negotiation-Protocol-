import { ContractClient } from "../contracts/client";
import { StrategyEngine } from "./strategy";
import { NEGOTIATION_DEFAULTS } from "../config";

export class NegotiationSkill {
  private client: ContractClient;
  private strategy: StrategyEngine;
  public maxRounds: number;
  public pollInterval: number;

  constructor(client: ContractClient, strategy: StrategyEngine, maxRounds?: number, pollInterval?: number) {
    this.client = client;
    this.strategy = strategy;
    this.maxRounds = maxRounds || NEGOTIATION_DEFAULTS.maxRounds;
    this.pollInterval = pollInterval || NEGOTIATION_DEFAULTS.pollIntervalMs;
  }

  static usdcToWei(usdc: number): bigint {
    return BigInt(Math.floor((usdc / 1000) * 1e18));
  }

  static weiToUsdc(wei: number): number {
    return (wei / 1e18) * 1000;
  }

  async openSession(seller: string, description: string, budgetCapUsdc: number, durationSeconds = 600): Promise<string> {
    const budgetWei = NegotiationSkill.usdcToWei(budgetCapUsdc);
    return this.client.openSession(seller, description, budgetWei, this.maxRounds, durationSeconds);
  }

  async runBuyerLoop(
    sessionId: string, budgetCapUsdc: number, sellerReputation: number,
    serviceDescription: string, onDeal: (session: any) => void
  ): Promise<any> {
    let lastSubmittedRound = -1;

    while (true) {
      await this.sleep(this.pollInterval);
      const session = await this.client.getSession(sessionId);

      if (session.status === "AGREED") {
        console.log(`[Negotiation] Deal at ${NegotiationSkill.weiToUsdc(session.agreedPrice).toFixed(4)} USDC`);
        onDeal(session);
        return session;
      }

      if (session.status === "EXPIRED" || session.status === "CANCELLED") {
        console.log(`[Negotiation] Session ended: ${session.status}`);
        return session;
      }

      const buyerOffers = session.buyerOffers;
      const sellerOffers = session.sellerOffers;
      const currentRound = session.currentRound;

      if (sellerOffers.length > buyerOffers.length && currentRound === buyerOffers.length && currentRound !== lastSubmittedRound) {
        const latestAsk = NegotiationSkill.weiToUsdc(sellerOffers[sellerOffers.length - 1]);
        const bidsUsdc = buyerOffers.map(NegotiationSkill.weiToUsdc);
        const asksUsdc = sellerOffers.map(NegotiationSkill.weiToUsdc);

        const result = await this.strategy.buyerStrategy({
          currentAskUsdc: latestAsk,
          budgetCapUsdc,
          currentRound,
          maxRounds: this.maxRounds,
          sellerReputation,
          bidHistory: bidsUsdc,
          askHistory: asksUsdc,
          serviceDescription,
        });

        const bidWei = NegotiationSkill.usdcToWei(result.offer);
        await this.client.submitBuyerBid(sessionId, bidWei);
        lastSubmittedRound = currentRound;
        console.log(`[Negotiation] Round ${currentRound + 1} bid: ${result.offer.toFixed(4)} USDC — ${result.reasoning}`);
      }
    }
  }

  async runSellerLoop(
    sellerAddress: string, floorPriceUsdc: number, serviceDescription: string, onDeal: (session: any) => void
  ): Promise<void> {
    const handledSessions = new Set<string>();
    const lastSubmitted = new Map<string, boolean>();

    while (true) {
      await this.sleep(this.pollInterval);

      let openSessions: string[];
      try {
        openSessions = await this.client.getOpenSessionsForSeller(sellerAddress);
      } catch {
        continue;
      }

      for (const sessionId of openSessions) {
        if (handledSessions.has(sessionId)) continue;
        const session = await this.client.getSession(sessionId);
        const buyerRep = await this.client.getReputationDisplay(session.buyer);
        if (buyerRep < 1.0) {
          console.log(`[Negotiation] Ignoring low-rep buyer: ${buyerRep.toFixed(1)}/10`);
          handledSessions.add(sessionId);
          continue;
        }
        console.log(`[Negotiation] New session from buyer rep ${buyerRep.toFixed(1)}/10`);
        handledSessions.add(sessionId);
      }

      for (const sessionHex of handledSessions) {
        const session = await this.client.getSession(sessionHex);

        if (session.status === "AGREED") {
          onDeal(session);
          continue;
        }
        if (session.status === "EXPIRED" || session.status === "CANCELLED") continue;

        const buyerOffers = session.buyerOffers;
        const sellerOffers = session.sellerOffers;
        const currentRound = session.currentRound;
        const roundKey = `${sessionHex}:${currentRound}`;

        if (buyerOffers.length > sellerOffers.length && currentRound === sellerOffers.length && !lastSubmitted.has(roundKey)) {
          const latestBid = buyerOffers.length > 0 ? NegotiationSkill.weiToUsdc(buyerOffers[buyerOffers.length - 1]) : 0;
          const bidsUsdc = buyerOffers.map(NegotiationSkill.weiToUsdc);
          const asksUsdc = sellerOffers.map(NegotiationSkill.weiToUsdc);
          const buyerRep = await this.client.getReputationDisplay(session.buyer);

          if (buyerOffers.length === 0) {
            const initialAsk = floorPriceUsdc * 2.5;
            const askWei = NegotiationSkill.usdcToWei(initialAsk);
            await this.client.submitSellerAsk(sessionHex, askWei);
            lastSubmitted.set(roundKey, true);
            console.log(`[Negotiation] Initial ask: ${initialAsk.toFixed(4)} USDC`);
            continue;
          }

          const result = await this.strategy.sellerStrategy({
            currentBidUsdc: latestBid,
            floorPriceUsdc,
            currentRound,
            maxRounds: this.maxRounds,
            buyerReputation: buyerRep * 1000,
            askHistory: asksUsdc,
            bidHistory: bidsUsdc,
            serviceDescription,
          });

          const askWei = NegotiationSkill.usdcToWei(result.offer);
          await this.client.submitSellerAsk(sessionHex, askWei);
          lastSubmitted.set(roundKey, true);
          console.log(`[Negotiation] Round ${currentRound + 1} ask: ${result.offer.toFixed(4)} USDC — ${result.reasoning}`);
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
