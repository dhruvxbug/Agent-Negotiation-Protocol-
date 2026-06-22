import os
from dotenv import load_dotenv
load_dotenv()

from anp_sdk import AgentSDK

service_endpoint = os.getenv("SELLER_SERVICE_ENDPOINT", "http://localhost:5001/service")

sdk = AgentSDK(private_key=os.getenv("BUYER_PRIVATE_KEY"), chain="fuji")
sdk.setup(
    name=f"BuyerAgent|{service_endpoint}",
    niche=os.getenv("SERVICE_NICHE", "data-analysis")
)

result = sdk.hire(
    service="Analyze top DeFi protocols on Avalanche and recommend allocation",
    niche=os.getenv("SERVICE_NICHE", "data-analysis"),
    max_price_usdc=float(os.getenv("BUYER_BUDGET_CAP_USDC", "100"))
)

print("\n=== Result ===")
print(f"Agreed price: {result['agreedPriceUsdc']:.4f} USDC")
print(f"Content: {result['content']}")
print("==============\n")
