"use client";

import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} antialiased font-sans bg-[#0a0a0a] text-gray-100`}>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={darkTheme()} coolMode>
              <nav className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between border-b border-gray-800">
                <Link href="/" className="text-xl font-bold text-white font-display">
                  AgentPact
                </Link>
                <div className="flex items-center gap-6 text-sm">
                  <Link href="/agents" className="text-gray-400 hover:text-white transition-colors">Agents</Link>
                  <Link href="/negotiate" className="text-gray-400 hover:text-white transition-colors">Negotiate</Link>
                  <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors">Leaderboard</Link>
                  <ConnectButton />
                </div>
              </nav>
              <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
                {children}
              </main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
