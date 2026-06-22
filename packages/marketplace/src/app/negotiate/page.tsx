"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useWalletClient } from "wagmi";
import { getRegistryContract, getEngineContract } from "@/lib/contracts";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function NegotiateForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [service, setService] = useState("");
  const [maxBudget, setMaxBudget] = useState(80);
  const [niche, setNiche] = useState("data-analysis");
  const [sellerAddr, setSellerAddr] = useState(searchParams.get("seller") || "");
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (sellerAddr) {
      const registry = getRegistryContract();
      registry.getAgent(sellerAddr).then((a) => {
        setSellerInfo({ ...a, reputation: Number(a.reputationScore) / 1000 });
      }).catch(() => setSellerInfo(null));
    }
  }, [sellerAddr]);

  async function startNegotiation() {
    if (!isConnected || !walletClient || !address) {
      setStatus("Please connect your wallet first");
      return;
    }
    setStatus("Opening session...");
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const engine = new ethers.Contract(
        process.env.NEXT_PUBLIC_NEGOTIATION_ENGINE_ADDRESS!,
        ["function openSession(address,string,uint256,uint256,uint256) returns (bytes32)"],
        signer
      );
      const budgetWei = ethers.parseEther((maxBudget / 1000).toString());
      const tx = await engine.openSession(sellerAddr, service, budgetWei, 5, 600);
      const receipt = await tx.wait();
      const log = receipt.logs.find((l: any) => l.fragment?.name === "SessionOpened");
      if (log) {
        setStatus("Session opened! Redirecting...");
        router.push(`/negotiate/${log.args.sessionId}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Start Negotiation</h1>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
        {!isConnected && (
          <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            Connect your wallet to start a negotiation
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Service Description</label>
          <textarea
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g., Analyze top DeFi protocols on Avalanche"
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Budget (USDC)</label>
            <input
              type="range" min="10" max="200" step="5" value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-right font-mono text-sm">{maxBudget} USDC</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Niche</label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg border border-gray-700"
            >
              <option value="data-analysis">Data Analysis</option>
              <option value="content">Content</option>
              <option value="computation">Computation</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Seller Address</label>
          <input
            type="text"
            value={sellerAddr}
            onChange={(e) => setSellerAddr(e.target.value)}
            placeholder="0x..."
            className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg border border-gray-700 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
          {sellerInfo && (
            <div className="mt-2 p-2 bg-gray-800/50 rounded-lg text-sm">
              <span className="text-gray-400">Seller: </span>
              <span className="text-white">{sellerInfo.name}</span>
              <span className="text-gray-500 ml-2">rep: {sellerInfo.reputation.toFixed(1)}/10</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          <ConnectButton />
          <button
            onClick={startNegotiation}
            disabled={!service || !sellerAddr}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Negotiation
          </button>
        </div>

        {status && (
          <div className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg">{status}</div>
        )}
      </div>
    </div>
  );
}

export default function NegotiatePage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500 py-12">Loading...</div>}>
      <NegotiateForm />
    </Suspense>
  );
}
