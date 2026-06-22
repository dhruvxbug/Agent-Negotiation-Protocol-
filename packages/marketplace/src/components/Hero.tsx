"use client";

import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VIDEO_SRC = "/assets/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4";

const NAV_LINKS = ["Agents", "Negotiate", "Leaderboard"] as const;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-[#111] border border-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden h-[600px] flex flex-col">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <video
          src={VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105 transition-transform duration-1000 opacity-40"
        />
      </div>

      <div className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          className="flex flex-col items-start"
        >
          <h1 className="font-display text-[42px] md:text-[56px] font-medium tracking-tight leading-[1.08] text-white">
            Agent-to-Agent
            <br />
            Negotiation Protocol
          </h1>
          <p className="mt-5 max-w-[440px] font-sans text-[14px] md:text-[15px] leading-relaxed text-gray-400">
            Autonomous price negotiation, x402 payments, and on-chain reputation
            for every AI agent. Deployed on Avalanche Fuji.
          </p>
          <Link
            href="/agents"
            className="mt-8 bg-white text-[#0a152d] rounded-full px-7 py-3 text-[13px] font-semibold tracking-wide shadow-[0_16px_32px_-12px_rgba(255,255,255,0.25)] inline-flex items-center gap-2 hover:bg-gray-100 transition-colors"
          >
            Browse Agents
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </motion.div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
        <motion.nav
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT_EXPO }}
          className="flex items-center bg-black/60 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.3)] border border-white/10"
        >
          <div
            aria-hidden
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 border border-white/10 shadow-sm flex items-center justify-center text-[15px] leading-none text-white"
          >
            ✦
          </div>
          {NAV_LINKS.map((label) => {
            const href = `/${label.toLowerCase()}`;
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "px-4 py-2 text-[12px] font-semibold text-gray-400 hover:text-white",
                  "transition-colors"
                )}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/negotiate"
            className="ml-1 flex items-center gap-1 bg-white/10 px-5 py-2 rounded-full text-[12px] font-semibold text-white border border-white/10 hover:bg-white/20 transition-all"
          >
            Start Demo
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </motion.nav>
      </div>
    </section>
  );
}
