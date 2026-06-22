"""
Seller demo using the AgentSDK public API.
Run this first, then buyer_demo.py.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from anp_sdk import AgentSDK

SERVICE = {
    "type": "defi-analysis",
    "title": "Avalanche DeFi Protocol Report",
    "data": {
        "topProtocols": [
            {"name": "Aave V3", "tvl": "$890M", "apy": "4.2%"},
            {"name": "Trader Joe", "tvl": "$210M", "apy": "12.8%"},
            {"name": "Benqi", "tvl": "$175M", "apy": "6.1%"}
        ],
        "recommendation": "40% stable yield (Aave), 35% LP (Trader Joe), 25% lending (Benqi)",
        "riskScore": 6.2,
        "generatedBy": "AgentPact Seller Demo"
    }
}

sdk = AgentSDK(
    private_key=os.getenv("SELLER_PRIVATE_KEY"),
    chain="fuji"
)

print("Setting up seller agent...")
sdk.setup(
    name=f"SellerAgent|{os.getenv('SELLER_SERVICE_ENDPOINT', 'http://localhost:5001/service')}",
    niche=os.getenv("SERVICE_NICHE", "data-analysis"),
    framework="raw"
)

print(f"Seller ready: {sdk.address}")
print(f"Reputation: {sdk.reputation():.1f}/10")
print(f"Listening for negotiation sessions on Fuji...\n")

sdk.list_as_seller(
    service_content=SERVICE,
    floor_price_usdc=float(os.getenv("SELLER_FLOOR_PRICE_USDC", "40")),
    port=int(os.getenv("SELLER_SERVICE_PORT", "5001"))
)
