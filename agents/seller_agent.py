import os
import time
import threading
from web3 import Web3
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from contract_client import ContractClient
from strategy import get_seller_strategy
from x402_client import X402Server

load_dotenv()

SELLER_PRIVATE_KEY = os.getenv("SELLER_PRIVATE_KEY")
FLOOR_PRICE_USDC = float(os.getenv("SELLER_FLOOR_PRICE", "40"))
MAX_ROUNDS = int(os.getenv("MAX_ROUNDS", "5"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
SERVICE_PORT = int(os.getenv("SELLER_SERVICE_PORT", "5001"))
NICHE = os.getenv("SERVICE_NICHE", "data-analysis")

FLOOR_PRICE_WEI = int(Web3.to_wei(FLOOR_PRICE_USDC / 1000, "ether"))

SERVICE_CONTENT = {
    "type": "market-analysis",
    "title": "Avalanche DeFi Protocol Analysis",
    "content": "Top protocols by TVL: Aave V3, Trader Joe, Benqi. Recommended allocation: 40% stable yield, 30% LP, 30% lending. Risk score: 6.2/10.",
    "generatedAt": "2026-06-15",
    "analyst": "Seller-Agent-Beta"
}

current_agreed_price_wei = None
active_sessions = {}


def run_x402_server(seller_address: str, w3: Web3):
    x402_server = X402Server(seller_address, w3)

    app = Flask(__name__)

    @app.route("/service", methods=["GET"])
    def serve_with_dynamic_price():
        global current_agreed_price_wei
        price = current_agreed_price_wei or FLOOR_PRICE_WEI
        payment_tx = request.headers.get("X-Payment-Tx")
        if not payment_tx:
            return jsonify({
                "x402Version": "1.0",
                "paymentRequired": True,
                "paymentAddress": seller_address,
                "chain": "avalanche-fuji",
                "chainId": 43113,
                "currency": "AVAX",
                "agreedPriceWei": str(price)
            }), 402
        if x402_server._verify_payment(payment_tx, price):
            x402_server.paid_transactions.add(payment_tx)
            return jsonify({"status": "delivered", "content": SERVICE_CONTENT, "paymentTx": payment_tx}), 200
        return jsonify({"error": "Payment verification failed"}), 402

    print(f"[Seller] x402 server starting on port {SERVICE_PORT}")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=False)


def run_seller_agent():
    global current_agreed_price_wei

    print("[Seller] Starting Autonomous Seller Agent")

    client = ContractClient(SELLER_PRIVATE_KEY)
    w3 = client.w3
    seller_address = client.address
    print(f"[Seller] Address: {seller_address}")

    server_thread = threading.Thread(
        target=run_x402_server,
        args=(seller_address, w3),
        daemon=True
    )
    server_thread.start()
    time.sleep(1)

    if not client.is_registered(seller_address):
        print("[Seller] Registering agent on-chain...")
        client.register_agent("Seller-Agent-Beta", NICHE)
        print("[Seller] Registered successfully")
    else:
        rep = client.get_reputation(seller_address)
        print(f"[Seller] Already registered. Reputation: {rep/1000:.1f}/10")

    handled_sessions = set()
    last_submitted = {}

    while True:
        time.sleep(POLL_INTERVAL)

        try:
            open_sessions = client.get_open_sessions_for_seller(seller_address)
        except Exception as e:
            print(f"[Seller] Error polling sessions: {e}")
            continue

        for session_id in open_sessions:
            session_hex = session_id.hex() if isinstance(session_id, bytes) else bytes(session_id).hex()

            if session_hex in handled_sessions:
                continue

            session = client.get_session(session_id)

            buyer_address = session["buyer"]
            buyer_rep = client.get_reputation(buyer_address)

            if buyer_rep < 1000:
                print(f"[Seller] Ignoring session from low-rep buyer: {buyer_rep/1000:.1f}/10")
                handled_sessions.add(session_hex)
                continue

            print(f"\n[Seller] Found open session: {session_hex[:16]}...")
            print(f"[Seller] Service: {session['serviceDescription']}")
            print(f"[Seller] Buyer reputation: {buyer_rep/1000:.1f}/10")

            active_sessions[session_hex] = session
            handled_sessions.add(session_hex)

            # Submit initial ask immediately upon joining
            buyer_budget_cap_wei = session["buyerBudgetCap"]
            buyer_budget_cap_usdc = Web3.from_wei(buyer_budget_cap_wei, "ether") * 1000
            initial_ask_usdc = min(FLOOR_PRICE_USDC * 2.5, buyer_budget_cap_usdc)
            initial_ask_wei = int(Web3.to_wei(initial_ask_usdc / 1000, "ether"))
            print(f"[Seller] Submitting initial ask: {initial_ask_usdc:.2f} USDC")
            client.submit_seller_ask(session_id, initial_ask_wei)
            last_submitted[f"{session_hex}:0"] = True
            print(f"[Seller] Initial ask submitted on-chain")

        for session_hex in list(active_sessions.keys()):
            session_id_bytes = bytes.fromhex(session_hex)
            session = client.get_session(session_id_bytes)
            status = session["status"]

            if status == 2:
                agreed_wei = session["agreedPrice"]
                current_agreed_price_wei = agreed_wei
                agreed_usdc = Web3.from_wei(agreed_wei, "ether") * 1000
                print(f"\n[Seller] DEAL REACHED at {agreed_usdc:.4f} USDC")
                print("[Seller] x402 server ready to accept payment")

                time.sleep(15)
                buyer_address = session["buyer"]
                client.submit_feedback(session_id_bytes, buyer_address, 5, True)
                print("[Seller] Feedback submitted")
                del active_sessions[session_hex]
                continue

            if status in (3, 4):
                print(f"[Seller] Session {session_hex[:16]} ended: status={status}")
                del active_sessions[session_hex]
                continue

            current_round = session["currentRound"]
            buyer_offers = session["buyerOffers"]
            seller_offers = session["sellerOffers"]

            round_key = f"{session_hex}:{current_round}"
            if (len(buyer_offers) > len(seller_offers) and
                current_round == len(seller_offers) and
                round_key not in last_submitted):

                latest_bid_wei = buyer_offers[-1]
                latest_bid_usdc = Web3.from_wei(latest_bid_wei, "ether") * 1000
                buyer_rep = client.get_reputation(session["buyer"])

                bids_usdc = [Web3.from_wei(b, "ether") * 1000 for b in buyer_offers]
                asks_usdc = [Web3.from_wei(a, "ether") * 1000 for a in seller_offers]

                print(f"\n[Seller] Round {current_round + 1}/{MAX_ROUNDS}")
                print(f"[Seller] Current bid: {latest_bid_usdc:.4f} USDC")

                strategy = get_seller_strategy(
                    current_bid_usdc=float(latest_bid_usdc),
                    floor_price_usdc=FLOOR_PRICE_USDC,
                    current_round=current_round,
                    max_rounds=MAX_ROUNDS,
                    buyer_reputation=buyer_rep,
                    ask_history=list(asks_usdc),
                    bid_history=list(bids_usdc),
                    service_description=session["serviceDescription"],
                )

                new_ask_usdc = strategy["offer"]
                reasoning = strategy["reasoning"]
                new_ask_wei = int(Web3.to_wei(new_ask_usdc / 1000, "ether"))

                print(f"[Seller] Claude says: ask {new_ask_usdc:.4f} USDC — {reasoning}")

                client.submit_seller_ask(session_id_bytes, new_ask_wei)
                last_submitted[round_key] = True
                print(f"[Seller] Ask submitted on-chain")


if __name__ == "__main__":
    run_seller_agent()
