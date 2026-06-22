"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getRegistryContract, getSkillsContract } from "@/lib/contracts";

const SKILL_LABELS = ["Identity", "Negotiation", "Payment", "PayServer", "Strategy"];
const SKILL_COLORS = ["purple", "teal", "blue", "green", "amber"];

function SkillBadge({ skill }: { skill: number }) {
  const color = SKILL_COLORS[skill] || "gray";
  const label = SKILL_LABELS[skill] || "Unknown";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-900/30 text-${color}-300 border border-${color}-700/40`}>
      {label}
    </span>
  );
}

function ReputationBadge({ score }: { score: number }) {
  const color = score < 4 ? "red" : score < 7 ? "yellow" : "green";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-${color}-900/30 text-${color}-300`}>
      {score.toFixed(1)}/10
    </span>
  );
}

function AgentCard({ address, name, niche, reputation, deals, skills, isFullyCapable }: any) {
  return (
    <Link href={`/agents/${address}`} className="block bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-white">{name || "Unknown"}</div>
          <div className="text-xs font-mono text-gray-500 mt-0.5">{address.slice(0, 6)}...{address.slice(-4)}</div>
        </div>
        <ReputationBadge score={reputation} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-400">{niche}</span>
        {isFullyCapable && <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded-full border border-blue-700/40">SDK ✓</span>}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(reputation * 10, 100)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{deals} deals</span>
        <span>{skills?.length || 0} skills</span>
      </div>
      {skills?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {skills.map((s: number) => <SkillBadge key={s} skill={s} />)}
        </div>
      )}
    </Link>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheFilter, setNicheFilter] = useState("");
  const [minRep, setMinRep] = useState(0);
  const [sdkOnly, setSdkOnly] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const registry = getRegistryContract();
      const skills = getSkillsContract();
      const total = Number(await registry.getTotalAgents());
      if (total === 0) { setLoading(false); return; }

      const addrs: string[] = [];
      for (let i = 0; i < total; i++) {
        addrs.push(await registry.agentIndex(i));
      }

      const results = [];
      for (const addr of addrs) {
        const agent = await registry.getAgent(addr);
        const agentSkills = await skills.getAgentSkills(addr);
        const capable = await skills.isFullyCapable(addr);
        results.push({
          address: addr,
          name: agent.name,
          niche: agent.serviceNiche,
          reputation: Number(agent.reputationScore) / 1000,
          deals: Number(agent.dealsCompleted),
          skills: agentSkills.map(Number),
          isFullyCapable: capable,
        });
      }
      setAgents(results);
    } catch (e) {
      console.error("Failed to load agents", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const filtered = agents.filter((a) => {
    if (nicheFilter && a.niche !== nicheFilter) return false;
    if (a.reputation < minRep) return false;
    if (sdkOnly && !a.isFullyCapable) return false;
    return true;
  });

  const niches = Array.from(new Set(agents.map((a) => a.niche)));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Agent Browser</h1>

      <div className="flex gap-4 mb-6 flex-wrap items-center bg-gray-900 rounded-xl p-4 border border-gray-800">
        <select
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm"
        >
          <option value="">All Niches</option>
          {niches.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Min Rep:</span>
          <input
            type="range" min="0" max="10" step="0.5" value={minRep}
            onChange={(e) => setMinRep(Number(e.target.value))}
            className="w-24"
          />
          <span className="font-mono w-8">{minRep.toFixed(1)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={sdkOnly} onChange={(e) => setSdkOnly(e.target.checked)} />
          SDK Certified
        </label>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} agents</span>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => <AgentCard key={agent.address} {...agent} />)}
          {filtered.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No agents found</div>}
        </div>
      )}
    </div>
  );
}
