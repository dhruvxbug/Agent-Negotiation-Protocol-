import { ContractClient } from "../contracts/client";

export class IdentitySkill {
  private client: ContractClient;
  public address: string;

  constructor(client: ContractClient) {
    this.client = client;
    this.address = client.address;
  }

  async ensureRegistered(name: string, niche: string): Promise<boolean> {
    const registered = await this.client.isRegistered(this.address);
    if (registered) return false;
    await this.client.registerAgent(name, niche);
    return true;
  }

  async ensureSkillsAttested(framework = "raw"): Promise<void> {
    const hasIdentity = await this.client.hasSkill(this.address, 0);
    if (!hasIdentity) {
      await this.client.attestAllSkills(framework);
    }
  }

  async getProfile(): Promise<any> {
    const agent = await this.client.getAgent(this.address);
    const skills = await this.client.getAgentSkills(this.address);
    const rep = await this.client.getReputationDisplay(this.address);
    return {
      address: this.address,
      name: agent.name,
      niche: agent.serviceNiche,
      reputation: rep,
      dealsCompleted: agent.dealsCompleted,
      skills,
      isFullyCapable: await this.client.isFullyCapable(this.address),
    };
  }

  async findSellers(
    niche: string, minReputation = 5.0, requireFullSdk = true, limit = 10
  ): Promise<any[]> {
    const candidates = await this.client.getAgentsByNiche(niche, limit * 2);
    const results: any[] = [];
    for (const addr of candidates) {
      const rep = await this.client.getReputationDisplay(addr);
      if (rep < minReputation) continue;
      if (requireFullSdk) {
        const capable = await this.client.isFullyCapable(addr);
        if (!capable) continue;
      }
      const agent = await this.client.getAgent(addr);
      results.push({
        address: addr,
        name: agent.name,
        reputation: rep,
        dealsCompleted: agent.dealsCompleted,
        isFullyCapable: requireFullSdk,
      });
    }
    results.sort((a, b) => b.reputation - a.reputation);
    return results.slice(0, limit);
  }
}
