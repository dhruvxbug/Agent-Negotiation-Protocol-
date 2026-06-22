import threading
from .contracts.client import ContractClient
from .core.identity import IdentitySkill
from .core.negotiation import NegotiationSkill
from .core.payment import X402Client, X402Server
from .core.strategy import StrategyEngine


class AgentSDK:

    def __init__(self, private_key: str, chain: str = "fuji",
                 llm_api_key: str = None):
        self.contract_client = ContractClient(private_key, chain)
        self.address = self.contract_client.address
        self.strategy = StrategyEngine(api_key=llm_api_key)
        self.identity = IdentitySkill(self.contract_client)
        self.negotiation = NegotiationSkill(self.contract_client, self.strategy)
        self.x402_client = X402Client(self.contract_client)
        self.x402_server = X402Server(self.contract_client)
        self._agreed_price_wei = None

    def setup(self, name: str, niche: str, framework: str = "raw") -> "AgentSDK":
        registered = self.identity.ensure_registered(name, niche)
        if registered:
            print(f"[AgentSDK] Registered as '{name}' in niche '{niche}'")
        self.identity.ensure_skills_attested(framework)
        print(f"[AgentSDK] Ready. Address: {self.address}")
        return self

    def hire(self, service: str, niche: str, max_price_usdc: float,
             min_reputation: float = 5.0, seller_address: str = None) -> dict:
        if not seller_address:
            sellers = self.identity.find_sellers(niche, min_reputation)
            if not sellers:
                raise RuntimeError(f"No qualified sellers found in niche: {niche}")
            seller = sellers[0]
            seller_address = seller["address"]
            seller_rep = seller["reputation"]
            print(f"[AgentSDK] Selected seller {seller_address[:10]}... rep={seller_rep:.1f}/10")
        else:
            seller_rep = self.contract_client.get_reputation_display(seller_address)

        seller_profile = self.contract_client.get_agent(seller_address)
        endpoint = "http://localhost:5001/service"
        if "|" in seller_profile.get("name", ""):
            endpoint = seller_profile["name"].split("|")[1]

        session_id = self.negotiation.open_session(
            seller=seller_address, description=service, budget_cap_usdc=max_price_usdc,
        )

        result_session = {}
        service_content = {}

        def on_deal(session):
            nonlocal result_session, service_content
            result_session = session
            self._agreed_price_wei = session["agreedPrice"]
            service_content = self.x402_client.request_service(
                endpoint_url=endpoint, agreed_price_wei=session["agreedPrice"]
            )
            session_id_bytes = bytes.fromhex(session["sessionId"])
            self.contract_client.submit_feedback(session_id_bytes, seller_address, 5, True)

        self.negotiation.run_buyer_loop(
            session_id=session_id, budget_cap_usdc=max_price_usdc,
            seller_reputation=seller_rep, service_description=service, on_deal=on_deal
        )

        return {
            "session": result_session,
            "content": service_content,
            "agreedPriceUsdc": NegotiationSkill._wei_to_usdc(result_session.get("agreedPrice", 0))
        }

    def list_as_seller(self, service_content: dict, floor_price_usdc: float,
                       niche: str = None, port: int = 5001) -> None:
        price_wei = NegotiationSkill._usdc_to_wei(floor_price_usdc)
        self._agreed_price_wei = price_wei

        app = self.x402_server.create_app(
            content_getter=lambda: service_content,
            price_wei_getter=lambda: self._agreed_price_wei or price_wei
        )

        def run_server():
            import logging
            log = logging.getLogger("werkzeug")
            log.setLevel(logging.ERROR)
            app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)

        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print(f"[AgentSDK] x402 server running on port {port}")

        def on_deal(session):
            self._agreed_price_wei = session["agreedPrice"]
            buyer = session["buyer"]
            session_id_bytes = bytes.fromhex(session["sessionId"])
            threading.Timer(
                10.0,
                lambda: self.contract_client.submit_feedback(session_id_bytes, buyer, 5, True)
            ).start()

        profile = self.identity.get_profile()
        self.negotiation.run_seller_loop(
            seller_address=self.address, floor_price_usdc=floor_price_usdc,
            service_description=f"{profile['niche']} service from {profile['name']}",
            on_deal=on_deal
        )

    def profile(self) -> dict:
        return self.identity.get_profile()

    def reputation(self) -> float:
        return self.contract_client.get_reputation_display(self.address)
