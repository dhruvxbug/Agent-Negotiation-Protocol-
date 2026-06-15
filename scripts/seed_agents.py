import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../agents"))

from contract_client import ContractClient
from dotenv import load_dotenv

load_dotenv()


def seed():
    print("Seeding agents...")

    buyer = ContractClient(os.getenv("BUYER_PRIVATE_KEY"))
    seller = ContractClient(os.getenv("SELLER_PRIVATE_KEY"))
    niche = os.getenv("SERVICE_NICHE", "data-analysis")

    if not buyer.is_registered(buyer.address):
        buyer.register_agent("Buyer-Agent-Alpha", niche)
        print(f"Buyer registered: {buyer.address}")
    else:
        print(f"Buyer already registered: {buyer.address}")

    if not seller.is_registered(seller.address):
        seller.register_agent("Seller-Agent-Beta", niche)
        print(f"Seller registered: {seller.address}")
    else:
        print(f"Seller already registered: {seller.address}")

    buyer_rep = buyer.get_reputation(buyer.address)
    seller_rep = seller.get_reputation(seller.address)
    print(f"\nBuyer reputation: {buyer_rep/1000:.1f}/10")
    print(f"Seller reputation: {seller_rep/1000:.1f}/10")
    print("\nSeed complete. Ready to negotiate.")


if __name__ == "__main__":
    seed()
