"use client";

import { useState, useEffect } from "react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectButton() {
  const [error, setError] = useState<string | null>(null);

  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <ConnectButtonInner
            ready={ready}
            connected={!!connected}
            account={account}
            chain={chain}
            openAccountModal={openAccountModal}
            openChainModal={openChainModal}
            openConnectModal={openConnectModal}
            error={error}
            setError={setError}
          />
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

function ConnectButtonInner({
  ready,
  connected,
  account,
  chain,
  openAccountModal,
  openChainModal,
  openConnectModal,
  error,
  setError,
}: {
  ready: boolean;
  connected: boolean;
  account: { displayName: string } | undefined;
  chain: { unsupported?: boolean } | undefined;
  openAccountModal: () => void;
  openChainModal: () => void;
  openConnectModal: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}) {
  // Clear error on successful connection
  useEffect(() => {
    if (connected && error) {
      setError(null);
    }
  }, [connected, error, setError]);

  const handleConnect = async () => {
    try {
      setError(null);
      openConnectModal();
    } catch {
      setError("Wallet connection failed. Please unlock MetaMask and try again.");
    }
  };

  return (
    <div
      {...(!ready && {
        "aria-hidden": true,
        style: {
          opacity: 0,
          pointerEvents: "none" as const,
          userSelect: "none" as const,
        },
      })}
    >
      {(() => {
        if (!connected) {
          return (
            <div className="flex flex-col items-center">
              <button
                id="connect-wallet-btn"
                onClick={handleConnect}
                type="button"
                className="btn-pulse btn-gold inline-flex items-center gap-2.5 rounded-sm px-8 py-3.5 text-[15px] font-semibold tracking-wide cursor-pointer font-sans"
              >
                <WalletIcon />
                Connect Wallet
              </button>
              {error && (
                <p
                  id="connect-wallet-error"
                  className="mt-3 text-[13px] font-medium text-red-400 animate-fade-in"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          );
        }

        if (chain?.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className="inline-flex items-center gap-2 rounded-sm bg-red-600/10 border border-red-500/30 px-6 py-3 text-[13px] font-medium text-red-400 tracking-wide transition-colors duration-200 hover:bg-red-600/20 cursor-pointer font-sans"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            type="button"
            id="account-btn"
            className="inline-flex items-center gap-2.5 rounded-sm border border-border bg-surface px-6 py-3 text-[13px] font-medium text-text-primary tracking-wide transition-colors duration-200 hover:bg-surface-raised cursor-pointer font-sans"
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            {account?.displayName}
          </button>
        );
      })()}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
