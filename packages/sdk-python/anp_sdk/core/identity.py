from ..contracts.client import ContractClient


class IdentitySkill:

    def __init__(self, client: ContractClient):
        self.client = client
        self.address = client.address

    def ensure_registered(self, name: str, niche: str) -> bool:
        if self.client.is_registered(self.address):
            return False
        self.client.register_agent(name, niche)
        return True

    def ensure_skills_attested(self, framework: str = "raw") -> None:
        if not self.client.has_skill(self.address, 0):
            self.client.attest_all_skills(framework)

    def get_profile(self) -> dict:
        agent = self.client.get_agent(self.address)
        skills = self.client.get_agent_skills(self.address)
        rep = self.client.get_reputation_display(self.address)
        return {
            "address": self.address,
            "name": agent.get("name"),
            "niche": agent.get("serviceNiche"),
            "reputation": rep,
            "dealsCompleted": agent.get("dealsCompleted", 0),
            "skills": skills,
            "isFullyCapable": self.client.is_fully_capable(self.address),
        }

    def find_sellers(self, niche: str, min_reputation: float = 5.0,
                     require_full_sdk: bool = True, limit: int = 10) -> list[dict]:
        candidates = self.client.get_agents_by_niche(niche, limit * 2)
        results = []
        for addr in candidates:
            rep = self.client.get_reputation_display(addr)
            if rep < min_reputation:
                continue
            if require_full_sdk and not self.client.is_fully_capable(addr):
                continue
            agent = self.client.get_agent(addr)
            results.append({
                "address": addr,
                "name": agent.get("name"),
                "reputation": rep,
                "dealsCompleted": agent.get("dealsCompleted", 0),
                "isFullyCapable": require_full_sdk,
            })
        results.sort(key=lambda x: x["reputation"], reverse=True)
        return results[:limit]
