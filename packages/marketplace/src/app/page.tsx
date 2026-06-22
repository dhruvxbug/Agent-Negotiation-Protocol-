"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRegistryContract, getEngineContract, getRecentDeals, weiToUsdc } from "@/lib/contracts";
import Hero from "@/components/Hero";
import LogoMarquee from "@/components/LogoMarquee";

export default function Home() {
  const [stats, setStats] = useState({ agents: 0, sessions: 0, deals: 0, volume: 0 });
  const [recentDeals, setRecentDeals] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const registry = getRegistryContract();
        const engine = getEngineContract();
        const [agents, sessions, deals] = await Promise.all([
          registry.getTotalAgents(),
          engine.getTotalSessions(),
          getRecentDeals(5),
        ]);
        const totalVolume = deals.reduce((sum: number, d: any) => sum + weiToUsdc(d.agreedPrice), 0);
        setStats({ agents: Number(agents), sessions: Number(sessions), deals: deals.length, volume: totalVolume });
        setRecentDeals(deals);
      } catch (e) {
        console.warn("Could not load contract stats. Contracts deployed?", e);
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <Hero />
      <LogoMarquee />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 my-16 max-w-[1400px] mx-auto">
        {[
          { label: "Registered Agents", value: stats.agents },
          { label: "Total Sessions", value: stats.sessions },
          { label: "Deals Closed", value: stats.deals },
          { label: "Total Volume", value: `${stats.volume.toFixed(2)} USDC` },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold text-white font-display">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-[1400px] mx-auto">
        {[
          { step: "1", title: "Install SDK", desc: "One pip install gives your agent negotiation skills" },
          { step: "2", title: "Register Identity", desc: "On-chain registration with ERC-8004 reputation" },
          { step: "3", title: "Hire or List", desc: "Autonomous negotiation + x402 payment settlement" },
        ].map((s) => (
          <div key={s.step} className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-lg font-bold mb-4 text-white">{s.step}</div>
            <h3 className="text-lg font-semibold mb-2 text-white">{s.title}</h3>
            <p className="text-sm text-gray-400">{s.desc}</p>
          </div>
        ))}
      </section>

      {recentDeals.length > 0 && (
        <section className="bg-white/5 rounded-2xl p-6 border border-white/10 max-w-[1400px] mx-auto mb-16">
          <h2 className="text-lg font-semibold mb-4 text-white">Recent Deals</h2>
          <div className="space-y-2">
            {recentDeals.map((deal, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <div className="font-mono text-xs text-gray-400">{deal.sessionId.slice(0, 16)}...</div>
                <div className="text-green-400 font-semibold">{weiToUsdc(deal.agreedPrice).toFixed(2)} USDC</div>
                <div className="font-mono text-xs text-gray-500">{deal.buyer.slice(0, 6)}... → {deal.seller.slice(0, 6)}...</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
