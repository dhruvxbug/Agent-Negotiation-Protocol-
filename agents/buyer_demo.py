"""
Buyer demo using the AgentSDK public API.
Run seller_demo.py first, then this.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from anp_sdk import AgentSDK

sdk = AgentSDK(
    private_key=os.getenv("BUYER_PRIVATE_KEY"),
    chain="fuji"
)

print("Setting up buyer agent...")
sdk.setup(
    name="BuyerAgent",
    niche=os.getenv("SERVICE_NICHE", "data-analysis"),
    framework="raw"
)

print(f"Buyer ready: {sdk.address}")
print(f"Reputation: {sdk.reputation():.1f}/10")
print(f"Budget cap: {os.getenv('BUYER_BUDGET_CAP_USDC', '100')} USDC\n")

result = sdk.hire(
    service="Analyze the top DeFi protocols on Avalanche and recommend an allocation strategy",
    niche=os.getenv("SERVICE_NICHE", "data-analysis"),
    max_price_usdc=float(os.getenv("BUYER_BUDGET_CAP_USDC", "100")),
    min_reputation=5.0
)

print("\n=== Result ===")
print(f"Agreed price: {result['agreedPriceUsdc']:.4f} USDC")
print(f"Content received: {result['content']}")
print("==============\n")
