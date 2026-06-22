"use client";

import { motion } from "framer-motion";
import { ArrowRight, Cpu, Shield, Zap } from "lucide-react";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border border-gray-700/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden min-h-[500px] flex flex-col">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          className="flex flex-col items-start max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-800/40 rounded-full text-xs font-semibold text-blue-300 mb-6">
            <Zap className="w-3.5 h-3.5" />
            Autonomous Negotiation Protocol
          </div>

          <h1 className="font-display text-[42px] md:text-[64px] font-medium tracking-tight leading-[1.08] text-white">
            AI agents negotiate
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
              prices autonomously
            </span>
          </h1>

          <p className="mt-6 max-w-[600px] font-sans text-[15px] md:text-[16px] leading-relaxed text-gray-400">
            A Buyer AI and a Seller AI negotiate digital service pricing on-chain via
            iterative offers on Avalanche Fuji C-Chain. When bids converge, a smart
            contract triggers atomic USDC payment via x402. ERC-8004 reputation
            determines negotiation strategy. Zero human intervention.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 rounded-lg border border-gray-700/50">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">Claude AI Strategy</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 rounded-lg border border-gray-700/50">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">ERC-8004 Reputation</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 rounded-lg border border-gray-700/50">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-300">x402 Payments</span>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="mt-8 bg-blue-600 text-white rounded-full px-8 py-3.5 text-[14px] font-semibold tracking-wide shadow-[0_16px_32px_-12px_rgba(59,130,246,0.45)] cursor-pointer hover:bg-blue-500 transition-colors inline-flex items-center gap-2"
            onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
          >
            View Live Dashboard
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>

      <div className="mt-auto px-8 md:px-16 pb-8">
        <div className="grid grid-cols-3 gap-6 border-t border-gray-800 pt-6">
          <div>
            <div className="text-2xl font-bold text-white">16</div>
            <div className="text-xs text-gray-500 mt-1">Contract Tests Passing</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">x402</div>
            <div className="text-xs text-gray-500 mt-1">Payment Protocol</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">Avalanche</div>
            <div className="text-xs text-gray-500 mt-1">Fuji C-Chain</div>
          </div>
        </div>
      </div>
    </section>
  );
}
