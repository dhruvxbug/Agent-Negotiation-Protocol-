import os
from dotenv import load_dotenv
load_dotenv()

from anp_sdk import AgentSDK

SERVICE_CONTENT = {
    "analysis": "Top Avalanche DeFi: Aave V3 TVL $890M, Trader Joe $210M, Benqi $175M",
    "recommendation": "40% stable yield, 35% LP, 25% lending",
    "riskScore": 6.2
}

sdk = AgentSDK(private_key=os.getenv("SELLER_PRIVATE_KEY"), chain="fuji")
sdk.setup(
    name=f"SellerAgent|{os.getenv('SELLER_SERVICE_ENDPOINT', 'http://localhost:5001/service')}",
    niche=os.getenv("SERVICE_NICHE", "data-analysis"),
    framework="raw"
)

print(f"Seller ready: {sdk.address}")
print(f"Reputation: {sdk.reputation():.1f}/10")
print("Listening for negotiation sessions on Fuji...\n")

sdk.list_as_seller(
    service_content=SERVICE_CONTENT,
    floor_price_usdc=float(os.getenv("SELLER_FLOOR_PRICE_USDC", "40")),
    port=int(os.getenv("SELLER_SERVICE_PORT", "5001"))
)
