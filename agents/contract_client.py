import os
import json
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

FUJI_RPC = os.getenv("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")

REGISTRY_ABI = [{"anonymous": False, "inputs": [{"indexed": True, "internalType": "address", "name": "wallet", "type": "address"}, {"indexed": False, "internalType": "string", "name": "name", "type": "string"}, {"indexed": False, "internalType": "string", "name": "niche", "type": "string"}], "name": "AgentRegistered", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "address", "name": "agent", "type": "address"}, {"indexed": False, "internalType": "uint256", "name": "dealsCompleted", "type": "uint256"}, {"indexed": False, "internalType": "uint256", "name": "totalEarned", "type": "uint256"}], "name": "DealStatsUpdated", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": True, "internalType": "address", "name": "rated", "type": "address"}, {"indexed": False, "internalType": "uint8", "name": "score", "type": "uint8"}], "name": "FeedbackSubmitted", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "address", "name": "agent", "type": "address"}, {"indexed": False, "internalType": "uint256", "name": "oldScore", "type": "uint256"}, {"indexed": False, "internalType": "uint256", "name": "newScore", "type": "uint256"}], "name": "ReputationUpdated", "type": "event"}, {"inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "name": "agentIndex", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "agents", "outputs": [{"internalType": "address", "name": "wallet", "type": "address"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "string", "name": "serviceNiche", "type": "string"}, {"internalType": "uint256", "name": "reputationScore", "type": "uint256"}, {"internalType": "uint256", "name": "totalRatings", "type": "uint256"}, {"internalType": "uint256", "name": "dealsCompleted", "type": "uint256"}, {"internalType": "uint256", "name": "dealsAbandoned", "type": "uint256"}, {"internalType": "uint256", "name": "totalEarnedWei", "type": "uint256"}, {"internalType": "uint256", "name": "registeredAt", "type": "uint256"}, {"internalType": "bool", "name": "isActive", "type": "bool"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "wallet", "type": "address"}], "name": "getAgent", "outputs": [{"components": [{"internalType": "address", "name": "wallet", "type": "address"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "string", "name": "serviceNiche", "type": "string"}, {"internalType": "uint256", "name": "reputationScore", "type": "uint256"}, {"internalType": "uint256", "name": "totalRatings", "type": "uint256"}, {"internalType": "uint256", "name": "dealsCompleted", "type": "uint256"}, {"internalType": "uint256", "name": "dealsAbandoned", "type": "uint256"}, {"internalType": "uint256", "name": "totalEarnedWei", "type": "uint256"}, {"internalType": "uint256", "name": "registeredAt", "type": "uint256"}, {"internalType": "bool", "name": "isActive", "type": "bool"}], "internalType": "struct AgentRegistry.Agent", "name": "", "type": "tuple"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "string", "name": "niche", "type": "string"}, {"internalType": "uint256", "name": "limit", "type": "uint256"}], "name": "getAgentsByNiche", "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "agent", "type": "address"}], "name": "getReputationScore", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}, {"inputs": [], "name": "getTotalAgents", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "isRegistered", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "agent", "type": "address"}], "name": "recordDealAbandoned", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "address", "name": "agent", "type": "address"}, {"internalType": "uint256", "name": "earnedWei", "type": "uint256"}], "name": "recordDealCompleted", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "string", "name": "name", "type": "string"}, {"internalType": "string", "name": "niche", "type": "string"}], "name": "registerAgent", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}, {"internalType": "uint256", "name": "", "type": "uint256"}], "name": "sessionFeedback", "outputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "address", "name": "rater", "type": "address"}, {"internalType": "address", "name": "rated", "type": "address"}, {"internalType": "uint8", "name": "score", "type": "uint8"}, {"internalType": "bool", "name": "deliveredOnTime", "type": "bool"}, {"internalType": "uint256", "name": "timestamp", "type": "uint256"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "address", "name": "rated", "type": "address"}, {"internalType": "uint8", "name": "score", "type": "uint8"}, {"internalType": "bool", "name": "deliveredOnTime", "type": "bool"}], "name": "submitFeedback", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]

ENGINE_ABI = [{"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": False, "internalType": "uint256", "name": "agreedPrice", "type": "uint256"}, {"indexed": False, "internalType": "address", "name": "buyer", "type": "address"}, {"indexed": False, "internalType": "address", "name": "seller", "type": "address"}], "name": "DealReached", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "NegotiationExpired", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": False, "internalType": "uint256", "name": "round", "type": "uint256"}, {"indexed": False, "internalType": "string", "name": "role", "type": "string"}, {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "OfferSubmitted", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": True, "internalType": "address", "name": "seller", "type": "address"}], "name": "SellerJoined", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": False, "internalType": "address", "name": "cancelledBy", "type": "address"}], "name": "SessionCancelled", "type": "event"}, {"anonymous": False, "inputs": [{"indexed": True, "internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"indexed": True, "internalType": "address", "name": "buyer", "type": "address"}, {"indexed": True, "internalType": "address", "name": "seller", "type": "address"}, {"indexed": False, "internalType": "string", "name": "serviceDescription", "type": "string"}], "name": "SessionOpened", "type": "event"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}, {"internalType": "uint256", "name": "", "type": "uint256"}], "name": "buyerSessions", "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "cancelSession", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "expireSession", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "getLatestOffers", "outputs": [{"internalType": "uint256", "name": "latestBid", "type": "uint256"}, {"internalType": "uint256", "name": "latestAsk", "type": "uint256"}, {"internalType": "uint256", "name": "round", "type": "uint256"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "getOfferHistory", "outputs": [{"internalType": "uint256[]", "name": "bids", "type": "uint256[]"}, {"internalType": "uint256[]", "name": "asks", "type": "uint256[]"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "seller", "type": "address"}], "name": "getOpenSessionsForSeller", "outputs": [{"internalType": "bytes32[]", "name": "openSessions", "type": "bytes32[]"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "name": "getSession", "outputs": [{"components": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "address", "name": "buyer", "type": "address"}, {"internalType": "address", "name": "seller", "type": "address"}, {"internalType": "string", "name": "serviceDescription", "type": "string"}, {"internalType": "uint256", "name": "buyerBudgetCap", "type": "uint256"}, {"internalType": "uint256", "name": "currentRound", "type": "uint256"}, {"internalType": "uint256", "name": "maxRounds", "type": "uint256"}, {"internalType": "uint256", "name": "agreedPrice", "type": "uint256"}, {"internalType": "uint256", "name": "deadline", "type": "uint256"}, {"internalType": "enum NegotiationEngine.SessionStatus", "name": "status", "type": "uint8"}, {"internalType": "uint256[]", "name": "buyerOffers", "type": "uint256[]"}, {"internalType": "uint256[]", "name": "sellerOffers", "type": "uint256[]"}], "internalType": "struct NegotiationEngine.Session", "name": "", "type": "tuple"}], "stateMutability": "view", "type": "function"}, {"inputs": [], "name": "getTotalSessions", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "seller", "type": "address"}, {"internalType": "string", "name": "serviceDescription", "type": "string"}, {"internalType": "uint256", "name": "buyerBudgetCap", "type": "uint256"}, {"internalType": "uint256", "name": "maxRounds", "type": "uint256"}, {"internalType": "uint256", "name": "durationSeconds", "type": "uint256"}], "name": "openSession", "outputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}, {"internalType": "uint256", "name": "", "type": "uint256"}], "name": "sellerSessions", "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "name": "sessionIds", "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "name": "sessions", "outputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "address", "name": "buyer", "type": "address"}, {"internalType": "address", "name": "seller", "type": "address"}, {"internalType": "string", "name": "serviceDescription", "type": "string"}, {"internalType": "uint256", "name": "buyerBudgetCap", "type": "uint256"}, {"internalType": "uint256", "name": "currentRound", "type": "uint256"}, {"internalType": "uint256", "name": "maxRounds", "type": "uint256"}, {"internalType": "uint256", "name": "agreedPrice", "type": "uint256"}, {"internalType": "uint256", "name": "deadline", "type": "uint256"}, {"internalType": "enum NegotiationEngine.SessionStatus", "name": "status", "type": "uint8"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "uint256", "name": "bidAmount", "type": "uint256"}], "name": "submitBuyerBid", "outputs": [], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}, {"internalType": "uint256", "name": "askAmount", "type": "uint256"}], "name": "submitSellerAsk", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]


class ContractClient:
    def __init__(self, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(FUJI_RPC))
        assert self.w3.is_connected(), "Cannot connect to Fuji RPC"

        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        registry_address = os.getenv("AGENT_REGISTRY_ADDRESS")
        engine_address = os.getenv("NEGOTIATION_ENGINE_ADDRESS")

        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(registry_address),
            abi=REGISTRY_ABI
        )
        self.engine = self.w3.eth.contract(
            address=Web3.to_checksum_address(engine_address),
            abi=ENGINE_ABI
        )

    def _send_tx(self, fn, gas=300000):
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = fn.build_transaction({
            "from": self.address,
            "nonce": nonce,
            "gas": gas,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "chainId": 43113,
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return receipt

    def register_agent(self, name: str, niche: str):
        fn = self.registry.functions.registerAgent(name, niche)
        return self._send_tx(fn)

    def is_registered(self, address: str) -> bool:
        return self.registry.functions.isRegistered(
            Web3.to_checksum_address(address)
        ).call()

    def get_reputation(self, address: str) -> int:
        return self.registry.functions.getReputationScore(
            Web3.to_checksum_address(address)
        ).call()

    def get_agents_by_niche(self, niche: str, limit: int = 5) -> list:
        return self.registry.functions.getAgentsByNiche(niche, limit).call()

    def submit_feedback(self, session_id: bytes, rated: str, score: int, on_time: bool):
        fn = self.registry.functions.submitFeedback(session_id, rated, score, on_time)
        return self._send_tx(fn)

    def open_session(self, seller: str, description: str, budget_cap_wei: int,
                     max_rounds: int, duration_seconds: int) -> bytes:
        fn = self.engine.functions.openSession(
            Web3.to_checksum_address(seller),
            description,
            budget_cap_wei,
            max_rounds,
            duration_seconds
        )
        receipt = self._send_tx(fn)

        logs = self.engine.events.SessionOpened().process_receipt(receipt)
        if logs:
            return logs[0]["args"]["sessionId"]
        raise RuntimeError("SessionOpened event not found in receipt")

    def submit_buyer_bid(self, session_id: bytes, bid_wei: int):
        fn = self.engine.functions.submitBuyerBid(session_id, bid_wei)
        return self._send_tx(fn)

    def submit_seller_ask(self, session_id: bytes, ask_wei: int):
        fn = self.engine.functions.submitSellerAsk(session_id, ask_wei)
        return self._send_tx(fn)

    def get_session(self, session_id: bytes) -> dict:
        s = self.engine.functions.getSession(session_id).call()
        return {
            "sessionId": s[0].hex(),
            "buyer": s[1],
            "seller": s[2],
            "serviceDescription": s[3],
            "buyerBudgetCap": s[4],
            "currentRound": s[5],
            "maxRounds": s[6],
            "agreedPrice": s[7],
            "deadline": s[8],
            "status": s[9],
            "buyerOffers": list(s[10]),
            "sellerOffers": list(s[11]),
        }

    def get_latest_offers(self, session_id: bytes) -> dict:
        bid, ask, round_num = self.engine.functions.getLatestOffers(session_id).call()
        return {"latestBid": bid, "latestAsk": ask, "round": round_num}

    def get_open_sessions_for_seller(self, seller: str) -> list:
        return self.engine.functions.getOpenSessionsForSeller(
            Web3.to_checksum_address(seller)
        ).call()

    def poll_for_deal(self, session_id: bytes) -> dict | None:
        session = self.get_session(session_id)
        if session["status"] == 2:
            return session
        return None
