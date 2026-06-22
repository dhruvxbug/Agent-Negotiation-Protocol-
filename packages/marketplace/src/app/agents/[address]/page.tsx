"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRegistryContract, getSkillsContract, weiToUsdc } from "@/lib/contracts";

export default function AgentProfilePage() {
  const { address } = useParams<{ address: string }>();
  const [agent, setAgent] = useState<any>(null);
  const [skills, setSkills] = useState<number[]>([]);
  const [capable, setCapable] = useState(false);
  const [loading, setLoading] = useState(true);

  const SKILL_LABELS = ["IDENTITY", "NEGOTIATION", "PAYMENT_X402", "PAYMENT_SERVER", "STRATEGY_AI"];

  useEffect(() => {
    async function load() {
      try {
        const registry = getRegistryContract();
        const skills = getSkillsContract();
        const a = await registry.getAgent(address);
        setAgent(a);
        const s = await skills.getAgentSkills(address);
        setSkills(s.map(Number));
        const c = await skills.isFullyCapable(address);
        setCapable(c);
      } catch (e) {
        console.error("Failed to load agent", e);
      }
      setLoading(false);
    }
    if (address) load();
  }, [address]);

  if (loading) return <div className="text-center text-gray-500 py-12">Loading agent profile...</div>;
  if (!agent) return <div className="text-center text-gray-500 py-12">Agent not found</div>;

  const rep = Number(agent.reputationScore) / 1000;

  return (
    <div>
      <Link href="/agents" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Agents</Link>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <div className="font-mono text-sm text-gray-500 mt-1">{address}</div>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">{agent.serviceNiche}</span>
              {capable && <span className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm border border-blue-700/40">SDK Certified</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-white">{rep.toFixed(1)}</div>
            <div className="text-sm text-gray-400">/ 10 reputation</div>
            <div className="w-32 bg-gray-700 rounded-full h-2 mt-2 ml-auto">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(rep * 10, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
          {[
            { label: "Total Ratings", value: Number(agent.totalRatings) },
            { label: "Deals Completed", value: Number(agent.dealsCompleted) },
            { label: "Deals Abandoned", value: Number(agent.dealsAbandoned) },
            { label: "Total Earned", value: `${weiToUsdc(Number(agent.totalEarnedWei)).toFixed(2)} USDC` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Skill Attestations</h2>
        {skills.length === 0 ? (
          <div className="text-sm text-gray-500">No skills attested</div>
        ) : (
          <div className="space-y-2">
            {skills.map((s) => (
              <div key={s} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono text-sm">{SKILL_LABELS[s] || `Skill ${s}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/negotiate?seller=${address}`}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-colors"
        >
          Start Negotiation with this Agent
        </Link>
      </div>
    </div>
  );
}
