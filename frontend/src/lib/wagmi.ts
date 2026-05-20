"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

export const config = getDefaultConfig({
  appName: "VenueFi",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});
