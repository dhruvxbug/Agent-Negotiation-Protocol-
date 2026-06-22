"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRegistryContract, getSkillsContract, weiToUsdc } from "@/lib/contracts";

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [nicheFilter, setNicheFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const registry = getRegistryContract();
        const skills = getSkillsContract();
        const total = Number(await registry.getTotalAgents());
        if (total === 0) return;

        const addrs: string[] = [];
        for (let i = 0; i < total; i++) {
          addrs.push(await registry.agentIndex(i));
        }

        const results = [];
        for (const addr of addrs) {
          const agent = await registry.getAgent(addr);
          const capable = await skills.isFullyCapable(addr);
          results.push({
            address: addr,
            name: agent.name,
            niche: agent.serviceNiche,
            reputation: Number(agent.reputationScore) / 1000,
            deals: Number(agent.dealsCompleted),
            earned: Number(agent.totalEarnedWei),
            isFullyCapable: capable,
          });
        }
        results.sort((a, b) => b.reputation - a.reputation);
        setAgents(results);
      } catch (e) {
        console.error("Failed to load leaderboard", e);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = nicheFilter ? agents.filter((a) => a.niche === nicheFilter) : agents;
  const niches = [...new Set(agents.map((a) => a.niche))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reputation Leaderboard</h1>
        <select
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm"
        >
          <option value="">All Niches</option>
          {niches.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-4">#</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Niche</th>
              <th className="text-right p-4">Reputation</th>
              <th className="text-right p-4">Deals</th>
              <th className="text-right p-4">Earned</th>
              <th className="text-center p-4">SDK</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((agent, i) => (
              <tr key={agent.address} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-4 font-mono text-gray-500">{i + 1}</td>
                <td className="p-4">
                  <Link href={`/agents/${agent.address}`} className="text-white hover:text-blue-400 font-medium">
                    {agent.name || "Unknown"}
                  </Link>
                  <div className="font-mono text-xs text-gray-600">{agent.address.slice(0, 6)}...</div>
                </td>
                <td className="p-4"><span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full">{agent.niche}</span></td>
                <td className="p-4 text-right font-mono">{agent.reputation.toFixed(1)}</td>
                <td className="p-4 text-right font-mono">{agent.deals}</td>
                <td className="p-4 text-right font-mono">{weiToUsdc(agent.earned).toFixed(2)} USDC</td>
                <td className="p-4 text-center">{agent.isFullyCapable ? <span className="text-green-400">✓</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">No agents found</div>
        )}
      </div>
    </div>
  );
}
