import os
import time
from web3 import Web3
from dotenv import load_dotenv
from contract_client import ContractClient
from strategy import get_buyer_strategy
from x402_client import X402Client

load_dotenv()

BUYER_PRIVATE_KEY = os.getenv("BUYER_PRIVATE_KEY")
SELLER_ADDRESS = os.getenv("SELLER_WALLET_ADDRESS")
SELLER_ENDPOINT = os.getenv("SELLER_SERVICE_ENDPOINT", "http://localhost:5001/service")
BUDGET_CAP_USDC = float(os.getenv("BUYER_BUDGET_CAP", "100"))
MAX_ROUNDS = int(os.getenv("MAX_ROUNDS", "5"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
SERVICE_DESCRIPTION = os.getenv("SERVICE_DESCRIPTION", "AI-powered market analysis report for Avalanche DeFi protocols")
NICHE = os.getenv("SERVICE_NICHE", "data-analysis")

BUDGET_CAP_WEI = Web3.to_wei(BUDGET_CAP_USDC / 1000, "ether")


def run_buyer_agent():
    print("[Buyer] Starting Autonomous Buyer Agent")

    client = ContractClient(BUYER_PRIVATE_KEY)
    x402 = X402Client(BUYER_PRIVATE_KEY)

    buyer_address = client.address
    print(f"[Buyer] Address: {buyer_address}")

    if not client.is_registered(buyer_address):
        print("[Buyer] Registering agent on-chain...")
        client.register_agent("Buyer-Agent-Alpha", NICHE)
        print("[Buyer] Registered successfully")
    else:
        rep = client.get_reputation(buyer_address)
        print(f"[Buyer] Already registered. Reputation: {rep/1000:.1f}/10")

    seller_rep = client.get_reputation(SELLER_ADDRESS)
    print(f"[Buyer] Seller reputation: {seller_rep/1000:.1f}/10")

    if seller_rep < 2000:
        print("[Buyer] Seller reputation too low. Aborting.")
        return

    print(f"[Buyer] Opening negotiation for: '{SERVICE_DESCRIPTION}'")
    session_id = client.open_session(
        seller=SELLER_ADDRESS,
        description=SERVICE_DESCRIPTION,
        budget_cap_wei=BUDGET_CAP_WEI,
        max_rounds=MAX_ROUNDS,
        duration_seconds=600
    )
    print(f"[Buyer] Session opened: {session_id.hex()}")

    negotiation_active = True
    last_submitted_round = -1

    while negotiation_active:
        time.sleep(POLL_INTERVAL)

        session = client.get_session(session_id)
        status = session["status"]

        if status == 2:
            agreed_price_wei = session["agreedPrice"]
            agreed_price_usdc = Web3.from_wei(agreed_price_wei, "ether") * 1000
            print(f"\n[Buyer] DEAL REACHED at {agreed_price_usdc:.4f} USDC")

            print(f"[Buyer] Triggering x402 payment to {SELLER_ENDPOINT}...")
            result = x402.request_service(SELLER_ENDPOINT, agreed_price_wei)
            print(f"[Buyer] Service received: {result}")

            time.sleep(3)
            print("[Buyer] Submitting feedback to registry...")
            client.submit_feedback(session_id, SELLER_ADDRESS, 5, True)
            print("[Buyer] Feedback submitted. Negotiation complete.")
            negotiation_active = False
            break

        elif status in (3, 4):
            print(f"[Buyer] Session ended with status: {status}")
            negotiation_active = False
            break

        current_round = session["currentRound"]
        buyer_offers = session["buyerOffers"]
        seller_offers = session["sellerOffers"]

        if (len(seller_offers) > len(buyer_offers) and
            current_round == len(buyer_offers) and
            current_round != last_submitted_round):

            latest_ask_wei = seller_offers[-1]
            latest_ask_usdc = Web3.from_wei(latest_ask_wei, "ether") * 1000

            bids_usdc = [Web3.from_wei(b, "ether") * 1000 for b in buyer_offers]
            asks_usdc = [Web3.from_wei(a, "ether") * 1000 for a in seller_offers]

            print(f"\n[Buyer] Round {current_round + 1}/{MAX_ROUNDS}")
            print(f"[Buyer] Current ask: {latest_ask_usdc:.4f} USDC")

            strategy = get_buyer_strategy(
                current_ask_usdc=float(latest_ask_usdc),
                budget_cap_usdc=BUDGET_CAP_USDC,
                current_round=current_round,
                max_rounds=MAX_ROUNDS,
                seller_reputation=seller_rep,
                bid_history=list(bids_usdc),
                ask_history=list(asks_usdc),
                service_description=SERVICE_DESCRIPTION,
            )

            new_bid_usdc = strategy["offer"]
            reasoning = strategy["reasoning"]
            new_bid_wei = int(Web3.to_wei(new_bid_usdc / 1000, "ether"))

            print(f"[Buyer] Claude says: bid {new_bid_usdc:.4f} USDC — {reasoning}")

            client.submit_buyer_bid(session_id, new_bid_wei)
            last_submitted_round = current_round
            print(f"[Buyer] Bid submitted on-chain")


if __name__ == "__main__":
    run_buyer_agent()
