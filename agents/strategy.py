import os
import json
from dotenv import load_dotenv

load_dotenv()


def call_llm(prompt: str) -> str:
    provider = os.getenv("LLM_PROVIDER", "anthropic").strip().lower()

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
        response = client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()

    elif provider == "groq":
        import openai
        client = openai.OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )
        model = os.getenv("LLM_MODEL", "llama3-70b-8192")
        response = client.chat.completions.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()

    elif provider == "openrouter":
        import openai
        client = openai.OpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1"
        )
        model = os.getenv("LLM_MODEL", "openai/gpt-4o")
        response = client.chat.completions.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()

    else:
        raise ValueError(f"Unsupported LLM provider: {provider}. Choose from: anthropic, groq, openrouter")


def parse_json_response(raw: str) -> dict:
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


def get_buyer_strategy(
    current_ask_usdc: float,
    budget_cap_usdc: float,
    current_round: int,
    max_rounds: int,
    seller_reputation: int,
    bid_history: list[float],
    ask_history: list[float],
    service_description: str,
) -> dict:
    seller_rep_display = seller_reputation / 1000

    prompt = f"""You are an autonomous Buyer AI agent in a price negotiation. You must decide your next bid.

SERVICE: {service_description}

NEGOTIATION STATE:
- Your maximum budget: {budget_cap_usdc} USDC (NEVER exceed this)
- Seller's current asking price: {current_ask_usdc} USDC
- Current round: {current_round + 1} of {max_rounds}
- Rounds remaining: {max_rounds - current_round - 1}
- Seller reputation: {seller_rep_display:.1f}/10 (higher = more trustworthy, pay closer to their ask)
- Your bid history: {bid_history}
- Seller ask history: {ask_history}

STRATEGY RULES:
1. NEVER bid above {budget_cap_usdc} USDC
2. Increase your bid each round — never decrease
3. If seller reputation > 8.0: be willing to concede more aggressively
4. If seller reputation < 5.0: hold firm, they need the deal more
5. As rounds run out, increase concession speed significantly
6. If the ask is already close to your budget cap, offer a final high bid
7. Calculate how fast the seller is conceding and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this bid>"}}"""

    raw = call_llm(prompt)
    result = parse_json_response(raw)

    result["offer"] = min(float(result["offer"]), budget_cap_usdc)
    result["offer"] = max(float(result["offer"]), 0.01)

    return result


def get_seller_strategy(
    current_bid_usdc: float,
    floor_price_usdc: float,
    current_round: int,
    max_rounds: int,
    buyer_reputation: int,
    ask_history: list[float],
    bid_history: list[float],
    service_description: str,
) -> dict:
    buyer_rep_display = buyer_reputation / 1000

    prompt = f"""You are an autonomous Seller AI agent in a price negotiation. You must decide your next asking price.

SERVICE: {service_description}

NEGOTIATION STATE:
- Your floor price (minimum acceptable): {floor_price_usdc} USDC (NEVER go below this)
- Buyer's current bid: {current_bid_usdc} USDC
- Current round: {current_round + 1} of {max_rounds}
- Rounds remaining: {max_rounds - current_round - 1}
- Buyer reputation: {buyer_rep_display:.1f}/10 (higher = reliable payer, you can afford to concede)
- Your ask history: {ask_history}
- Buyer bid history: {bid_history}

STRATEGY RULES:
1. NEVER ask below {floor_price_usdc} USDC
2. Decrease your ask each round — never increase
3. If buyer reputation > 8.0: concede more generously, they are a good customer
4. If buyer reputation < 5.0: hold firm, require higher price as risk premium
5. As rounds run out, reduce your ask faster
6. If the bid is already very close to your floor price, make a final concession to close the deal
7. Calculate how fast the buyer is bidding up and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this ask>"}}"""

    raw = call_llm(prompt)
    result = parse_json_response(raw)

    result["offer"] = max(float(result["offer"]), floor_price_usdc)

    return result
