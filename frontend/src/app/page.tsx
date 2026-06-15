"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const ENGINE_ADDRESS = process.env.NEXT_PUBLIC_ENGINE_ADDRESS || "";
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "";

const ENGINE_ABI = [
  "event SessionOpened(bytes32 indexed sessionId, address indexed buyer, address indexed seller, string serviceDescription)",
  "event OfferSubmitted(bytes32 indexed sessionId, uint256 round, string role, uint256 amount)",
  "event DealReached(bytes32 indexed sessionId, uint256 agreedPrice, address buyer, address seller)",
  "event NegotiationExpired(bytes32 indexed sessionId)",
  "function getSession(bytes32 sessionId) view returns (tuple(bytes32 sessionId, address buyer, address seller, string serviceDescription, uint256 buyerBudgetCap, uint256 currentRound, uint256 maxRounds, uint256 agreedPrice, uint256 deadline, uint8 status, uint256[] buyerOffers, uint256[] sellerOffers))",
  "function getLatestOffers(bytes32 sessionId) view returns (uint256 latestBid, uint256 latestAsk, uint256 round)",
  "function getTotalSessions() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function getReputationScore(address agent) view returns (uint256)",
  "function getAgent(address wallet) view returns (tuple(address wallet, string name, string serviceNiche, uint256 reputationScore, uint256 totalRatings, uint256 dealsCompleted, uint256 dealsAbandoned, uint256 totalEarnedWei, uint256 registeredAt, bool isActive))",
];

type OfferEvent = {
  round: number;
  role: string;
  amount: number;
  reasoning?: string;
  timestamp: number;
};

type SessionData = {
  sessionId: string;
  buyer: string;
  seller: string;
  serviceDescription: string;
  buyerBudgetCap: number;
  currentRound: number;
  maxRounds: number;
  agreedPrice: number;
  deadline: number;
  status: number;
  buyerOffers: number[];
  sellerOffers: number[];
};

type AgentInfo = {
  name: string;
  reputation: number;
  dealsCompleted: number;
  totalEarned: number;
};

const STATUS_MAP = ["OPEN", "ACTIVE", "AGREED", "EXPIRED", "CANCELLED"];
const STATUS_COLORS = ["#3b82f6", "#eab308", "#22c55e", "#ef4444", "#6b7280"];

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function weiToUsdc(wei: number) {
  return (wei / 1e18) * 1000;
}

function formatTime(ts: number) {
  if (!ts) return "--:--:--";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString();
}

function getCountdown(deadline: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "EXPIRED";
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [engine, setEngine] = useState<ethers.Contract | null>(null);
  const [registry, setRegistry] = useState<ethers.Contract | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [offers, setOffers] = useState<OfferEvent[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [buyerInfo, setBuyerInfo] = useState<AgentInfo | null>(null);
  const [sellerInfo, setSellerInfo] = useState<AgentInfo | null>(null);
  const [dealtx, setDealtx] = useState<string | null>(null);

  const initProvider = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const p = new ethers.BrowserProvider((window as any).ethereum);
    setProvider(p);
    if (ENGINE_ADDRESS) {
      const c = new ethers.Contract(ENGINE_ADDRESS, ENGINE_ABI, p);
      setEngine(c);
    }
    if (REGISTRY_ADDRESS) {
      const c = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, p);
      setRegistry(c);
    }
  }, []);

  const fetchAgentInfo = useCallback(async (address: string, reg: ethers.Contract) => {
    try {
      const a = await reg.getAgent(address);
      const rep = await reg.getReputationScore(address);
      return {
        name: a.name,
        reputation: Number(rep) / 1000,
        dealsCompleted: Number(a.dealsCompleted),
        totalEarned: Number(a.totalEarnedWei),
      };
    } catch {
      return { name: "Unknown", reputation: 0, dealsCompleted: 0, totalEarned: 0 };
    }
  }, []);

  const listenForEvents = useCallback(async (sid: string) => {
    if (!engine) return;
    const filter = engine.filters.OfferSubmitted(sid);
    engine.on(filter, (sessionId: string, round: bigint, role: string, amount: bigint) => {
      const usdc = weiToUsdc(Number(amount));
      setOffers((prev) => [
        ...prev,
        { round: Number(round), role, amount: usdc, timestamp: Date.now() },
      ]);
    });
    const dealFilter = engine.filters.DealReached(sid);
    engine.on(dealFilter, (sessionId: string, price: bigint) => {
      setDealtx(`Deal at ${weiToUsdc(Number(price)).toFixed(2)} USDC`);
    });
  }, [engine]);

  const pollSession = useCallback(async () => {
    if (!engine || !sessionId) return;
    try {
      const s = await engine.getSession(sessionId);
      const data: SessionData = {
        sessionId: s.sessionId,
        buyer: s.buyer,
        seller: s.seller,
        serviceDescription: s.serviceDescription,
        buyerBudgetCap: weiToUsdc(Number(s.buyerBudgetCap)),
        currentRound: Number(s.currentRound),
        maxRounds: Number(s.maxRounds),
        agreedPrice: weiToUsdc(Number(s.agreedPrice)),
        deadline: Number(s.deadline),
        status: Number(s.status),
        buyerOffers: s.buyerOffers.map((b: bigint) => weiToUsdc(Number(b))),
        sellerOffers: s.sellerOffers.map((a: bigint) => weiToUsdc(Number(a))),
      };
      setSession(data);

      const points: any[] = [];
      const maxLen = Math.max(data.buyerOffers.length, data.sellerOffers.length);
      for (let i = 0; i < maxLen; i++) {
        points.push({
          round: i + 1,
          bid: data.buyerOffers[i] ?? null,
          ask: data.sellerOffers[i] ?? null,
        });
      }
      setChartData(points);

      if (registry) {
        if (data.buyer) {
          const b = await fetchAgentInfo(data.buyer, registry);
          setBuyerInfo(b);
        }
        if (data.seller) {
          const s = await fetchAgentInfo(data.seller, registry);
          setSellerInfo(s);
        }
      }
    } catch (e) {
      console.error("Poll error", e);
    }
  }, [engine, sessionId, registry, fetchAgentInfo]);

  useEffect(() => {
    initProvider();
  }, [initProvider]);

  useEffect(() => {
    if (!sessionId) return;
    listenForEvents(sessionId);
    pollSession();
    const interval = setInterval(pollSession, 5000);
    return () => clearInterval(interval);
  }, [sessionId, listenForEvents, pollSession]);

  const getLatestOffers = () => {
    if (!session) return { bid: 0, ask: 0 };
    const bid = session.buyerOffers.length > 0 ? session.buyerOffers[session.buyerOffers.length - 1] : 0;
    const ask = session.sellerOffers.length > 0 ? session.sellerOffers[session.sellerOffers.length - 1] : 0;
    return { bid, ask };
  };

  const gapPercent = () => {
    const { bid, ask } = getLatestOffers();
    if (bid === 0 || ask === 0) return 100;
    return ((ask - bid) / ask) * 100;
  };

  const { bid: latestBid, ask: latestAsk } = getLatestOffers();
  const gap = gapPercent();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Autonomous Negotiation Protocol</h1>
          <p className="text-sm text-gray-400">AI agents negotiate prices on Avalanche Fuji C-Chain</p>
        </div>
        <div className="flex gap-4">
          {buyerInfo && (
            <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
              <div className="text-xs text-blue-400 font-mono">{buyerInfo.name}</div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(buyerInfo.reputation * 10, 100)}%` }} />
                </div>
                <span className="text-sm font-mono">{buyerInfo.reputation.toFixed(1)}</span>
              </div>
            </div>
          )}
          {sellerInfo && (
            <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
              <div className="text-xs text-green-400 font-mono">{sellerInfo.name}</div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(sellerInfo.reputation * 10, 100)}%` }} />
                </div>
                <span className="text-sm font-mono">{sellerInfo.reputation.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Session Panel */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Session Panel</h2>
          {session ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Session ID</span>
                <span className="font-mono text-xs">{truncateAddr(session.sessionId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Service</span>
                <span className="text-sm text-right max-w-[200px]">{session.serviceDescription}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  session.status === 2 ? "bg-green-900 text-green-300" :
                  session.status === 0 ? "bg-blue-900 text-blue-300" :
                  session.status === 1 ? "bg-yellow-900 text-yellow-300" :
                  session.status === 3 ? "bg-red-900 text-red-300" : "bg-gray-700 text-gray-300"
                }`}>
                  {STATUS_MAP[session.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Round</span>
                <span className="font-mono">{session.currentRound} / {session.maxRounds}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Countdown</span>
                <span className="font-mono">{getCountdown(session.deadline)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Buyer Budget</span>
                <span className="font-mono">{session.buyerBudgetCap.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Buyer</span>
                <span className="font-mono text-xs">{truncateAddr(session.buyer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Seller</span>
                <span className="font-mono text-xs">{truncateAddr(session.seller)}</span>
              </div>
              {session.status === 2 && (
                <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <div className="text-green-400 font-bold text-lg">AGREED: {session.agreedPrice.toFixed(2)} USDC</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Waiting for session data...</div>
          )}
        </div>

        {/* Right: Offer Feed */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Offer Feed</h2>
          <div className="h-[300px] overflow-y-auto space-y-2">
            {offers.length === 0 && (
              <div className="text-gray-500 text-sm">No offers yet...</div>
            )}
            {offers.map((o, i) => (
              <div key={i} className={`p-2 rounded text-sm ${
                o.role === "buyer" ? "bg-blue-900/20 border-l-2 border-blue-500" : "bg-green-900/20 border-l-2 border-green-500"
              }`}>
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-gray-400">[Round {o.round + 1} · {o.role}]</span>
                  <span className="font-mono text-xs text-gray-500">{formatTime(Math.floor(o.timestamp / 1000))}</span>
                </div>
                <div className="font-mono font-bold">{o.amount.toFixed(2)} USDC</div>
                {o.reasoning && <div className="text-xs text-gray-400 mt-1">"{o.reasoning}"</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-6 bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Negotiation Chart</h2>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" label={{ value: "Round", position: "bottom", fill: "#9ca3af" }} />
                <YAxis stroke="#9ca3af" label={{ value: "USDC", angle: -90, position: "insideLeft", fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
                {gap < 20 && gap > 0 && (
                  <ReferenceArea
                    x1={chartData.length - 1}
                    x2={chartData.length}
                    fill="#eab308"
                    fillOpacity={0.15}
                  />
                )}
                <Line type="monotone" dataKey="bid" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} name="Buyer Bid" connectNulls />
                <Line type="monotone" dataKey="ask" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 4 }} name="Seller Ask" connectNulls />
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

      {/* Bottom Panel */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* x402 Payment Panel */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">x402 Payment</h2>
          {session?.status === 2 ? (
            <div>
              <div className="text-green-400 font-bold text-lg mb-2">Agreed: {session.agreedPrice.toFixed(2)} USDC</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="animate-spin h-3 w-3 border-2 border-green-500 border-t-transparent rounded-full" />
                <span>Payment firing...</span>
              </div>
              {dealtx && (
                <div className="mt-2 p-2 bg-green-900/20 rounded text-sm">
                  <span className="text-green-400">Service delivered</span>
                  <div className="font-mono text-xs text-gray-400 mt-1">{dealtx}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Waiting for agreement...</div>
          )}
        </div>

        {/* Reputation Panel */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Reputation</h2>
          <div className="space-y-4">
            {buyerInfo && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blue-400">{buyerInfo.name}</span>
                  <span className="font-mono">{buyerInfo.reputation.toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${Math.min(buyerInfo.reputation * 10, 100)}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">Deals: {buyerInfo.dealsCompleted}</div>
              </div>
            )}
            {sellerInfo && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-400">{sellerInfo.name}</span>
                  <span className="font-mono">{sellerInfo.reputation.toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: `${Math.min(sellerInfo.reputation * 10, 100)}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Deals: {sellerInfo.dealsCompleted} · Earned: {weiToUsdc(sellerInfo.totalEarned).toFixed(2)} USDC
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
