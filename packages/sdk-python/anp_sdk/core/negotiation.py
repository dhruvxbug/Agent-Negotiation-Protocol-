import time
from web3 import Web3
from ..contracts.client import ContractClient
from .strategy import StrategyEngine
from ..config import NEGOTIATION_DEFAULTS


class NegotiationSkill:

    def __init__(self, client: ContractClient, strategy: StrategyEngine,
                 max_rounds: int = None, poll_interval: int = None):
        self.client = client
        self.strategy = strategy
        self.max_rounds = max_rounds or NEGOTIATION_DEFAULTS["max_rounds"]
        self.poll_interval = poll_interval or NEGOTIATION_DEFAULTS["poll_interval"]

    # ── Buyer side ─────────────────────────────────────────────────

    def open_session(self, seller: str, description: str,
                     budget_cap_usdc: float, duration_seconds: int = 600) -> bytes:
        budget_wei = self._usdc_to_wei(budget_cap_usdc)
        session_id = self.client.open_session(
            seller=seller, description=description, budget_cap_wei=budget_wei,
            max_rounds=self.max_rounds, duration_seconds=duration_seconds
        )
        print(f"[Negotiation] Session opened: {session_id.hex()[:16]}...")
        return session_id

    def run_buyer_loop(self, session_id: bytes, budget_cap_usdc: float,
                       seller_reputation: float, service_description: str,
                       on_deal: callable) -> dict | None:
        last_submitted_round = -1
        while True:
            time.sleep(self.poll_interval)
            session = self.client.get_session(session_id)

            if session["status"] == "AGREED":
                print(f"[Negotiation] Deal at {self._wei_to_usdc(session['agreedPrice']):.4f} USDC")
                on_deal(session)
                return session

            if session["status"] in ("EXPIRED", "CANCELLED"):
                print(f"[Negotiation] Session ended: {session['status']}")
                return session

            buyer_offers = session["buyerOffers"]
            seller_offers = session["sellerOffers"]
            current_round = session["currentRound"]

            if (len(seller_offers) > len(buyer_offers) and
                current_round == len(buyer_offers) and
                current_round != last_submitted_round):

                latest_ask = self._wei_to_usdc(seller_offers[-1])
                bids_usdc = [self._wei_to_usdc(b) for b in buyer_offers]
                asks_usdc = [self._wei_to_usdc(a) for a in seller_offers]

                result = self.strategy.buyer_strategy(
                    current_ask_usdc=latest_ask, budget_cap_usdc=budget_cap_usdc,
                    current_round=current_round, max_rounds=self.max_rounds,
                    seller_reputation=seller_reputation, bid_history=bids_usdc,
                    ask_history=asks_usdc, service_description=service_description,
                )

                bid_wei = self._usdc_to_wei(result["offer"])
                self.client.submit_buyer_bid(session_id, bid_wei)
                last_submitted_round = current_round
                print(f"[Negotiation] Round {current_round+1} bid: {result['offer']:.4f} USDC — {result['reasoning']}")

    # ── Seller side ────────────────────────────────────────────────

    def run_seller_loop(self, seller_address: str, floor_price_usdc: float,
                        service_description: str, on_deal: callable) -> None:
        handled_sessions = set()
        last_submitted = {}

        while True:
            time.sleep(self.poll_interval)
            try:
                open_sessions = self.client.get_open_sessions_for_seller(seller_address)
            except Exception as e:
                print(f"[Negotiation] Poll error: {e}")
                continue

            for session_id in open_sessions:
                session_hex = session_id.hex() if hasattr(session_id, 'hex') else bytes(session_id).hex()
                if session_hex in handled_sessions:
                    continue

                session = self.client.get_session(session_id)
                buyer_rep = self.client.get_reputation_display(session["buyer"])

                if buyer_rep < 1.0:
                    print(f"[Negotiation] Ignoring low-rep buyer: {buyer_rep:.1f}/10")
                    handled_sessions.add(session_hex)
                    continue

                print(f"[Negotiation] New session from buyer rep {buyer_rep:.1f}/10")
                handled_sessions.add(session_hex)

            for session_hex in list(handled_sessions):
                session_id_bytes = bytes.fromhex(session_hex)
                session = self.client.get_session(session_id_bytes)

                if session["status"] == "AGREED":
                    on_deal(session)
                    continue

                if session["status"] in ("EXPIRED", "CANCELLED"):
                    continue

                buyer_offers = session["buyerOffers"]
                seller_offers = session["sellerOffers"]
                current_round = session["currentRound"]
                round_key = f"{session_hex}:{current_round}"

                if (len(buyer_offers) > len(seller_offers) and
                    current_round == len(seller_offers) and
                    round_key not in last_submitted):

                    latest_bid = self._wei_to_usdc(buyer_offers[-1]) if buyer_offers else 0
                    bids_usdc = [self._wei_to_usdc(b) for b in buyer_offers]
                    asks_usdc = [self._wei_to_usdc(a) for a in seller_offers]
                    buyer_rep = self.client.get_reputation_display(session["buyer"])

                    if not buyer_offers:
                        initial_ask = floor_price_usdc * 2.5
                        ask_wei = self._usdc_to_wei(initial_ask)
                        self.client.submit_seller_ask(session_id_bytes, ask_wei)
                        last_submitted[round_key] = True
                        print(f"[Negotiation] Initial ask: {initial_ask:.4f} USDC")
                        continue

                    result = self.strategy.seller_strategy(
                        current_bid_usdc=latest_bid, floor_price_usdc=floor_price_usdc,
                        current_round=current_round, max_rounds=self.max_rounds,
                        buyer_reputation=buyer_rep, ask_history=asks_usdc,
                        bid_history=bids_usdc, service_description=service_description,
                    )

                    ask_wei = self._usdc_to_wei(result["offer"])
                    self.client.submit_seller_ask(session_id_bytes, ask_wei)
                    last_submitted[round_key] = True
                    print(f"[Negotiation] Round {current_round+1} ask: {result['offer']:.4f} USDC — {result['reasoning']}")

    # ── Helpers ────────────────────────────────────────────────────

    @staticmethod
    def _usdc_to_wei(usdc: float) -> int:
        return int(Web3.to_wei(usdc / 1000, "ether"))

    @staticmethod
    def _wei_to_usdc(wei: int) -> float:
        return float(Web3.from_wei(wei, "ether")) * 1000
