try:
    from crewai_tools import BaseTool
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False

from ..sdk import AgentSDK


def get_crewai_tools(sdk: AgentSDK) -> list:
    if not CREWAI_AVAILABLE:
        raise ImportError("crewai not installed. Run: pip install anp-sdk[crewai]")

    class HireAgentTool(BaseTool):
        name: str = "hire_agent"
        description: str = (
            "Hire an autonomous AI agent to complete a task. "
            "Negotiates price automatically and pays via x402. "
            "Input: JSON with keys: service (str), niche (str), max_price_usdc (float)"
        )
        _sdk: AgentSDK = sdk

        def _run(self, service: str, niche: str, max_price_usdc: float = 50.0) -> str:
            result = self._sdk.hire(service=service, niche=niche, max_price_usdc=max_price_usdc)
            return str(result.get("content", "No content received"))

    class CheckReputationTool(BaseTool):
        name: str = "check_agent_reputation"
        description: str = "Check the on-chain reputation score of an agent address. Input: wallet address string"
        _sdk: AgentSDK = sdk

        def _run(self, address: str) -> str:
            rep = self._sdk.contract_client.get_reputation_display(address)
            profile = self._sdk.contract_client.get_agent(address)
            return f"Agent {address[:10]}...: reputation {rep:.1f}/10, deals completed: {profile.get('dealsCompleted', 0)}"

    class FindSellersTool(BaseTool):
        name: str = "find_sellers"
        description: str = "Find available sellers in a service niche ranked by reputation. Input: niche (str)"
        _sdk: AgentSDK = sdk

        def _run(self, niche: str) -> str:
            sellers = self._sdk.identity.find_sellers(niche)
            if not sellers:
                return f"No sellers found in niche: {niche}"
            lines = [f"- {s['address'][:10]}... rep={s['reputation']:.1f}/10 deals={s['dealsCompleted']}" for s in sellers]
            return f"Sellers in '{niche}':\n" + "\n".join(lines)

    return [HireAgentTool(), CheckReputationTool(), FindSellersTool()]
