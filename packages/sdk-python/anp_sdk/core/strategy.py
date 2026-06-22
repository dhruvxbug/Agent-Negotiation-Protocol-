import json
import anthropic
from ..config import LLM_CONFIG


class StrategyEngine:

    def __init__(self, api_key: str = None, model: str = None):
        self.client = anthropic.Anthropic(api_key=api_key or LLM_CONFIG["api_key"])
        self.model = model or LLM_CONFIG["model"]

    def buyer_strategy(self, current_ask_usdc: float, budget_cap_usdc: float,
                       current_round: int, max_rounds: int, seller_reputation: float,
                       bid_history: list[float], ask_history: list[float],
                       service_description: str) -> dict:
        seller_rep_display = seller_reputation

        prompt = self._buyer_prompt(
            current_ask_usdc, budget_cap_usdc, current_round, max_rounds,
            seller_rep_display, bid_history, ask_history, service_description
        )
        raw = self._call(prompt)
        result = json.loads(raw)
        result["offer"] = min(float(result["offer"]), budget_cap_usdc)
        result["offer"] = max(float(result["offer"]), 0.01)
        return result

    def seller_strategy(self, current_bid_usdc: float, floor_price_usdc: float,
                        current_round: int, max_rounds: int, buyer_reputation: float,
                        ask_history: list[float], bid_history: list[float],
                        service_description: str) -> dict:
        buyer_rep_display = buyer_reputation

        prompt = self._seller_prompt(
            current_bid_usdc, floor_price_usdc, current_round, max_rounds,
            buyer_rep_display, ask_history, bid_history, service_description
        )
        raw = self._call(prompt)
        result = json.loads(raw)
        result["offer"] = max(float(result["offer"]), floor_price_usdc)
        return result

    def _call(self, prompt: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=LLM_CONFIG["max_tokens"],
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return raw

    def _buyer_prompt(self, ask_usdc, budget, round_num, max_rounds, rep, bids, asks, desc) -> str:
        return f"""You are an autonomous Buyer AI agent in a price negotiation. You must decide your next bid.

SERVICE: {desc}

NEGOTIATION STATE:
- Your maximum budget: {budget} USDC (NEVER exceed this)
- Seller's current asking price: {ask_usdc} USDC
- Current round: {round_num + 1} of {max_rounds}
- Rounds remaining: {max_rounds - round_num - 1}
- Seller reputation: {rep:.1f}/10 (higher = more trustworthy, pay closer to their ask)
- Your bid history: {bids}
- Seller ask history: {asks}

STRATEGY RULES:
1. NEVER bid above {budget} USDC
2. Increase your bid each round — never decrease
3. If seller reputation > 8.0: be willing to concede more aggressively
4. If seller reputation < 5.0: hold firm, they need the deal more
5. As rounds run out, increase concession speed significantly
6. If the ask is already close to your budget cap, offer a final high bid
7. Calculate how fast the seller is conceding and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this bid>"}}"""

    def _seller_prompt(self, bid_usdc, floor, round_num, max_rounds, rep, asks, bids, desc) -> str:
        return f"""You are an autonomous Seller AI agent in a price negotiation. You must decide your next asking price.

SERVICE: {desc}

NEGOTIATION STATE:
- Your floor price (minimum acceptable): {floor} USDC (NEVER go below this)
- Buyer's current bid: {bid_usdc} USDC
- Current round: {round_num + 1} of {max_rounds}
- Rounds remaining: {max_rounds - round_num - 1}
- Buyer reputation: {rep:.1f}/10 (higher = reliable payer, you can afford to concede)
- Your ask history: {asks}
- Buyer bid history: {bids}

STRATEGY RULES:
1. NEVER ask below {floor} USDC
2. Decrease your ask each round — never increase
3. If buyer reputation > 8.0: concede more generously, they are a good customer
4. If buyer reputation < 5.0: hold firm, require higher price as risk premium
5. As rounds run out, reduce your ask faster
6. If the bid is already very close to your floor price, make a final concession to close the deal
7. Calculate how fast the buyer is bidding up and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this ask>"}}"""
