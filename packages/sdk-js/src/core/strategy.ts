export class StrategyEngine {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "claude-sonnet-4-6") {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = model;
  }

  async buyerStrategy(params: {
    currentAskUsdc: number;
    budgetCapUsdc: number;
    currentRound: number;
    maxRounds: number;
    sellerReputation: number;
    bidHistory: number[];
    askHistory: number[];
    serviceDescription: string;
  }): Promise<{ offer: number; reasoning: string }> {
    const { currentAskUsdc, budgetCapUsdc, currentRound, maxRounds, sellerReputation, bidHistory, askHistory, serviceDescription } = params;
    const repDisplay = sellerReputation;

    const prompt = this.buyerPrompt(currentAskUsdc, budgetCapUsdc, currentRound, maxRounds, repDisplay, bidHistory, askHistory, serviceDescription);
    const result = await this.callLLM(prompt);
    result.offer = Math.min(result.offer, budgetCapUsdc);
    result.offer = Math.max(result.offer, 0.01);
    return result;
  }

  async sellerStrategy(params: {
    currentBidUsdc: number;
    floorPriceUsdc: number;
    currentRound: number;
    maxRounds: number;
    buyerReputation: number;
    askHistory: number[];
    bidHistory: number[];
    serviceDescription: string;
  }): Promise<{ offer: number; reasoning: string }> {
    const { currentBidUsdc, floorPriceUsdc, currentRound, maxRounds, buyerReputation, askHistory, bidHistory, serviceDescription } = params;
    const repDisplay = buyerReputation;

    const prompt = this.sellerPrompt(currentBidUsdc, floorPriceUsdc, currentRound, maxRounds, repDisplay, askHistory, bidHistory, serviceDescription);
    const result = await this.callLLM(prompt);
    result.offer = Math.max(result.offer, floorPriceUsdc);
    return result;
  }

  private async callLLM(prompt: string): Promise<{ offer: number; reasoning: string }> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json() as { content: { text: string }[] };
    let raw = data.content[0].text;
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(raw);
  }

  private buyerPrompt(askUsdc: number, budget: number, round: number, maxRounds: number, rep: number, bids: number[], asks: number[], desc: string): string {
    return `You are an autonomous Buyer AI agent in a price negotiation. You must decide your next bid.

SERVICE: ${desc}

NEGOTIATION STATE:
- Your maximum budget: ${budget} USDC (NEVER exceed this)
- Seller's current asking price: ${askUsdc} USDC
- Current round: ${round + 1} of ${maxRounds}
- Rounds remaining: ${maxRounds - round - 1}
- Seller reputation: ${rep.toFixed(1)}/10
- Your bid history: ${JSON.stringify(bids)}
- Seller ask history: ${JSON.stringify(asks)}

STRATEGY RULES:
1. NEVER bid above ${budget} USDC
2. Increase your bid each round — never decrease
3. If seller reputation > 8.0: be willing to concede more aggressively
4. If seller reputation < 5.0: hold firm
5. As rounds run out, increase concession speed significantly
6. If the ask is close to your budget cap, offer a final high bid
7. Calculate how fast the seller is conceding and match their pace

Respond ONLY with valid JSON: {"offer": <number>, "reasoning": "<one sentence>"}`;
  }

  private sellerPrompt(bidUsdc: number, floor: number, round: number, maxRounds: number, rep: number, asks: number[], bids: number[], desc: string): string {
    return `You are an autonomous Seller AI agent in a price negotiation. You must decide your next asking price.

SERVICE: ${desc}

NEGOTIATION STATE:
- Your floor price (minimum): ${floor} USDC (NEVER go below this)
- Buyer's current bid: ${bidUsdc} USDC
- Current round: ${round + 1} of ${maxRounds}
- Rounds remaining: ${maxRounds - round - 1}
- Buyer reputation: ${rep.toFixed(1)}/10
- Your ask history: ${JSON.stringify(asks)}
- Buyer bid history: ${JSON.stringify(bids)}

STRATEGY RULES:
1. NEVER ask below ${floor} USDC
2. Decrease your ask each round — never increase
3. If buyer reputation > 8.0: concede more generously
4. If buyer reputation < 5.0: hold firm
5. As rounds run out, reduce your ask faster
6. If the bid is close to your floor, make a final concession
7. Match the buyer's pace (reciprocity)

Respond ONLY with valid JSON: {"offer": <number>, "reasoning": "<one sentence>"}`;
  }
}
