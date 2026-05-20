"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectButton() {
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
                  <button
                    id="connect-wallet-btn"
                    onClick={openConnectModal}
                    type="button"
                    className="btn-pulse inline-flex items-center gap-2.5 rounded-sm bg-btn-bg px-8 py-3.5 text-[15px] font-normal text-btn-text tracking-wide transition-colors duration-200 hover:bg-btn-hover cursor-pointer font-sans"
                  >
                    <WalletIcon />
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
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
                  {account.displayName}
                </button>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
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
