from web3 import Web3
from ..config import CHAIN_CONFIGS, DEFAULT_CHAIN, load_abi


SESSION_STATUS = {0: "OPEN", 1: "ACTIVE", 2: "AGREED", 3: "EXPIRED", 4: "CANCELLED"}


class ContractClient:

    def __init__(self, private_key: str, chain: str = None):
        self.chain_name = chain or DEFAULT_CHAIN
        self.chain_config = CHAIN_CONFIGS[self.chain_name]
        self.w3 = Web3(Web3.HTTPProvider(self.chain_config["rpc_url"]))
        assert self.w3.is_connected(), f"Cannot connect to {self.chain_config['name']}"

        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        addrs = self.chain_config["contracts"]
        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(addrs["AgentRegistry"]),
            abi=load_abi("AgentRegistry")
        )
        self.engine = self.w3.eth.contract(
            address=Web3.to_checksum_address(addrs["NegotiationEngine"]),
            abi=load_abi("NegotiationEngine")
        )
        self.skills = self.w3.eth.contract(
            address=Web3.to_checksum_address(addrs["SkillRegistry"]),
            abi=load_abi("SkillRegistry")
        )

    def _send_tx(self, fn, gas=300000):
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = fn.build_transaction({
            "from": self.address,
            "nonce": nonce,
            "gas": gas,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "chainId": self.chain_config["chain_id"],
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise RuntimeError(f"Transaction failed: {tx_hash.hex()}")
        return receipt

    # ── AgentRegistry ──────────────────────────────────────────────

    def register_agent(self, name: str, niche: str) -> dict:
        fn = self.registry.functions.registerAgent(name, niche)
        return self._send_tx(fn)

    def is_registered(self, address: str) -> bool:
        return self.registry.functions.isRegistered(Web3.to_checksum_address(address)).call()

    def get_reputation(self, address: str) -> int:
        return self.registry.functions.getReputationScore(Web3.to_checksum_address(address)).call()

    def get_reputation_display(self, address: str) -> float:
        return self.get_reputation(address) / 1000

    def get_agent(self, address: str) -> dict:
        raw = self.registry.functions.getAgent(Web3.to_checksum_address(address)).call()
        return {
            "wallet": raw[0],
            "name": raw[1],
            "serviceNiche": raw[2],
            "reputationScore": raw[3],
            "totalRatings": raw[4],
            "dealsCompleted": raw[5],
            "dealsAbandoned": raw[6],
            "totalEarnedWei": raw[7],
            "registeredAt": raw[8],
            "isActive": raw[9],
        }

    def get_agents_by_niche(self, niche: str, limit: int = 10) -> list:
        return self.registry.functions.getAgentsByNiche(niche, limit).call()

    def submit_feedback(self, session_id: bytes, rated: str, score: int, on_time: bool) -> dict:
        fn = self.registry.functions.submitFeedback(session_id, Web3.to_checksum_address(rated), score, on_time)
        return self._send_tx(fn)

    def record_deal_completed(self, agent: str, earned_wei: int) -> dict:
        fn = self.registry.functions.recordDealCompleted(Web3.to_checksum_address(agent), earned_wei)
        return self._send_tx(fn)

    # ── NegotiationEngine ──────────────────────────────────────────

    def open_session(self, seller: str, description: str, budget_cap_wei: int,
                     max_rounds: int, duration_seconds: int) -> bytes:
        fn = self.engine.functions.openSession(
            Web3.to_checksum_address(seller), description, budget_cap_wei, max_rounds, duration_seconds
        )
        receipt = self._send_tx(fn, gas=400000)
        logs = self.engine.events.SessionOpened().process_receipt(receipt)
        if logs:
            return logs[0]["args"]["sessionId"]
        raise RuntimeError("SessionOpened event not found in receipt")

    def submit_buyer_bid(self, session_id: bytes, bid_wei: int) -> dict:
        fn = self.engine.functions.submitBuyerBid(session_id, bid_wei)
        return self._send_tx(fn)

    def submit_seller_ask(self, session_id: bytes, ask_wei: int) -> dict:
        fn = self.engine.functions.submitSellerAsk(session_id, ask_wei)
        return self._send_tx(fn)

    def get_session(self, session_id: bytes) -> dict:
        raw = self.engine.functions.getSession(session_id).call()
        return {
            "sessionId": raw[0].hex(),
            "buyer": raw[1],
            "seller": raw[2],
            "serviceDescription": raw[3],
            "buyerBudgetCap": raw[4],
            "currentRound": raw[5],
            "maxRounds": raw[6],
            "agreedPrice": raw[7],
            "deadline": raw[8],
            "status": SESSION_STATUS.get(raw[9], "UNKNOWN"),
            "statusCode": raw[9],
            "buyerOffers": list(raw[10]),
            "sellerOffers": list(raw[11]),
        }

    def get_latest_offers(self, session_id: bytes) -> dict:
        bid, ask, round_num = self.engine.functions.getLatestOffers(session_id).call()
        return {"latestBid": bid, "latestAsk": ask, "round": round_num}

    def get_open_sessions_for_seller(self, seller: str) -> list:
        return self.engine.functions.getOpenSessionsForSeller(Web3.to_checksum_address(seller)).call()

    def expire_session(self, session_id: bytes) -> dict:
        fn = self.engine.functions.expireSession(session_id)
        return self._send_tx(fn)

    # ── SkillRegistry ──────────────────────────────────────────────

    def attest_skill(self, skill_type: int, sdk_version: str, framework: str) -> dict:
        fn = self.skills.functions.attestSkill(skill_type, sdk_version, framework)
        return self._send_tx(fn)

    def has_skill(self, agent: str, skill_type: int) -> bool:
        return self.skills.functions.hasSkill(Web3.to_checksum_address(agent), skill_type).call()

    def is_fully_capable(self, agent: str) -> bool:
        return self.skills.functions.isFullyCapable(Web3.to_checksum_address(agent)).call()

    def get_agent_skills(self, agent: str) -> list:
        return [int(s) for s in self.skills.functions.getAgentSkills(Web3.to_checksum_address(agent)).call()]

    def attest_all_skills(self, framework: str = "raw") -> dict:
        from ..config import SDK_VERSION
        last_receipt = None
        for i in range(5):
            last_receipt = self.attest_skill(i, SDK_VERSION, framework)
        return last_receipt
