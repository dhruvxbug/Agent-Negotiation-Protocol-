from ..sdk import AgentSDK


class RawAdapter:
    """Simple wrapper for using AgentSDK without a framework adapter."""

    def __init__(self, sdk: AgentSDK):
        self.sdk = sdk

    def hire_seller(self, service: str, niche: str, max_price_usdc: float) -> dict:
        return self.sdk.hire(service=service, niche=niche, max_price_usdc=max_price_usdc)

    def get_reputation(self, address: str) -> float:
        return self.sdk.contract_client.get_reputation_display(address)

    def list_sellers(self, niche: str) -> list:
        return self.sdk.identity.find_sellers(niche)
