"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http, createPublicClient } from "viem";

// ---------------------------------------------------------------------------
// Wagmi config (used by WagmiProvider / RainbowKit)
// ---------------------------------------------------------------------------

export const config = getDefaultConfig({
  appName: "VenueFi",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

// ---------------------------------------------------------------------------
// Standalone viem public client (for direct reads outside React tree)
// ---------------------------------------------------------------------------

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});
