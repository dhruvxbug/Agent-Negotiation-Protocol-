"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { getEngineContract, getRegistryContract, weiToUsdc } from "@/lib/contracts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-900 text-blue-300",
  ACTIVE: "bg-yellow-900 text-yellow-300",
  AGREED: "bg-green-900 text-green-300",
  EXPIRED: "bg-red-900 text-red-300",
  CANCELLED: "bg-gray-700 text-gray-300",
};

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SessionViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [buyerInfo, setBuyerInfo] = useState<any>(null);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const offersEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    offersEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [offers]);

  useEffect(() => {
    if (!sessionId) return;

    async function poll() {
      try {
        const engine = getEngineContract();
        const registry = getRegistryContract();
        const s = await engine.getSession(sessionId);
        const data = {
          sessionId: s.sessionId,
          buyer: s.buyer,
          seller: s.seller,
          serviceDescription: s.serviceDescription,
          buyerBudgetCap: weiToUsdc(s.buyerBudgetCap),
          currentRound: Number(s.currentRound),
          maxRounds: Number(s.maxRounds),
          agreedPrice: weiToUsdc(s.agreedPrice),
          deadline: Number(s.deadline),
          status: ["OPEN", "ACTIVE", "AGREED", "EXPIRED", "CANCELLED"][Number(s.status)],
          buyerOffers: s.buyerOffers,
          sellerOffers: s.sellerOffers,
        };
        setSession(data);

        const points: any[] = [];
        const maxLen = Math.max(data.buyerOffers.length, data.sellerOffers.length);
        for (let i = 0; i < maxLen; i++) {
          points.push({
            round: i + 1,
            bid: i < data.buyerOffers.length ? weiToUsdc(data.buyerOffers[i]) : null,
            ask: i < data.sellerOffers.length ? weiToUsdc(data.sellerOffers[i]) : null,
          });
        }
        setChartData(points);

        if (data.buyer) {
          registry.getAgent(data.buyer).then((a) => setBuyerInfo(a)).catch(() => {});
        }
        if (data.seller) {
          registry.getAgent(data.seller).then((a) => setSellerInfo(a)).catch(() => {});
        }

        const newOffers: any[] = [];
        for (let i = 0; i < data.buyerOffers.length; i++) {
          newOffers.push({ round: i, role: "buyer", amount: weiToUsdc(data.buyerOffers[i]), timestamp: Date.now() });
        }
        for (let i = 0; i < data.sellerOffers.length; i++) {
          newOffers.push({ round: i, role: "seller", amount: weiToUsdc(data.sellerOffers[i]), timestamp: Date.now() });
        }
        newOffers.sort((a, b) => a.round - b.round || (a.role === "seller" ? -1 : 1));
        setOffers(newOffers);

        if (data.status === "AGREED" && !txHash) {
          setTxHash(`Deal at ${data.agreedPrice.toFixed(2)} USDC`);
        }
      } catch (e) {
        console.error("Poll error", e);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [sessionId, txHash]);

  const latestBid = session?.buyerOffers?.length > 0 ? weiToUsdc(session.buyerOffers[session.buyerOffers.length - 1]) : 0;
  const latestAsk = session?.sellerOffers?.length > 0 ? weiToUsdc(session.sellerOffers[session.sellerOffers.length - 1]) : 0;
  const gap = latestBid && latestAsk ? ((latestAsk - latestBid) / latestAsk) * 100 : 100;

  return (
    <div>
      <Link href="/negotiate" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back</Link>

      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Session Viewer</h1>
            <div className="font-mono text-xs text-gray-500 mt-1">{sessionId?.slice(0, 32)}...</div>
          </div>
          {session && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[session.status] || "bg-gray-700 text-gray-300"}`}>
              {session.status}
            </span>
          )}
        </div>
        {session && (
          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <div className="text-gray-400">Service</div>
              <div className="text-white">{session.serviceDescription}</div>
            </div>
            <div>
              <div className="text-gray-400">Round</div>
              <div className="text-white font-mono">{session.currentRound} / {session.maxRounds}</div>
            </div>
            <div>
              <div className="text-gray-400">Buyer</div>
              <div className="text-white font-mono text-xs">{truncateAddr(session.buyer)} {buyerInfo ? `(${buyerInfo.name})` : ""}</div>
            </div>
            <div>
              <div className="text-gray-400">Seller</div>
              <div className="text-white font-mono text-xs">{truncateAddr(session.seller)} {sellerInfo ? `(${sellerInfo.name})` : ""}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-lg font-semibold mb-4">Negotiation Chart</h2>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" label={{ value: "Round", position: "bottom", fill: "#9ca3af" }} />
                <YAxis stroke="#9ca3af" label={{ value: "USDC", angle: -90, position: "insideLeft", fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151" }} />
                {gap < 20 && gap > 0 && <ReferenceArea x1={chartData.length - 1} x2={chartData.length} fill="#eab308" fillOpacity={0.15} />}
                <Line type="monotone" dataKey="bid" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} name="Buyer Bid" connectNulls isAnimationActive />
                <Line type="monotone" dataKey="ask" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 4 }} name="Seller Ask" connectNulls isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">Waiting for offers...</div>
          )}
        </div>
        {gap < 20 && gap > 0 && (
          <div className="mt-2 text-center">
            <span className="inline-block px-3 py-1 bg-yellow-900/40 text-yellow-300 rounded-full text-xs font-semibold animate-pulse">
              Convergence zone — gap is {gap.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Offer Feed</h2>
          <div className="h-[300px] overflow-y-auto space-y-2">
            {offers.length === 0 && <div className="text-gray-500 text-sm">Waiting for offers...</div>}
            {offers.map((o, i) => (
              <div key={i} className={`p-2 rounded text-sm ${o.role === "buyer" ? "bg-blue-900/20 border-l-2 border-blue-500" : "bg-green-900/20 border-l-2 border-green-500"}`}>
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-gray-400">[Round {o.round + 1} &middot; {o.role === "buyer" ? "Buyer" : "Seller"}]</span>
                </div>
                <div className="font-mono font-bold">{o.amount.toFixed(2)} USDC</div>
              </div>
            ))}
            <div ref={offersEndRef} />
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">x402 Payment</h2>
          {session?.status === "AGREED" ? (
            <div>
              <div className="text-green-400 font-bold text-lg mb-2">Agreed: {session.agreedPrice.toFixed(2)} USDC</div>
              <div className="flex items-center gap-2 text-sm">
                {txHash ? <div className="w-3 h-3 bg-green-500 rounded-full" /> : <div className="animate-spin h-3 w-3 border-2 border-green-500 border-t-transparent rounded-full" />}
                <span>{txHash ? "Payment confirmed" : "Payment firing..."}</span>
              </div>
              {txHash && (
                <div className="mt-2 p-2 bg-green-900/20 rounded text-sm">
                  <span className="text-green-400">Service delivered</span>
                  <div className="font-mono text-xs text-gray-400 mt-1">{txHash}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Waiting for agreement...</div>
          )}

          <h2 className="text-lg font-semibold mb-4 mt-6">Reputation</h2>
          <div className="space-y-3">
            {buyerInfo && (
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-400">{buyerInfo.name || "Buyer"}</span>
                  <span className="font-mono">{(Number(buyerInfo.reputationScore) / 1000).toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(Number(buyerInfo.reputationScore) / 100, 100)}%` }} />
                </div>
              </div>
            )}
            {sellerInfo && (
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">{sellerInfo.name || "Seller"}</span>
                  <span className="font-mono">{(Number(sellerInfo.reputationScore) / 1000).toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(Number(sellerInfo.reputationScore) / 100, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
