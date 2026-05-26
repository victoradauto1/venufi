"use client";

import type { TransactionState } from "@/types/transaction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncates a transaction hash to 0x1234…abcd format.
 */
function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionStatusProps {
  state: TransactionState;
  /** Optional block explorer base URL (e.g. "https://sepolia.etherscan.io") */
  explorerUrl?: string;
}

/**
 * Reusable transaction feedback panel.
 *
 * Renders contextual UI for each stage of the transaction lifecycle:
 *  - pendingSignature → "Waiting for wallet signature…"
 *  - confirming       → "Transaction submitted, confirming…" + hash link
 *  - success          → "Transaction confirmed" + hash link
 *  - error            → error message
 *  - idle             → renders nothing
 *
 * Designed to match VenueFi's visual language:
 * muted surfaces, subtle borders, serif/sans consistency.
 */
export function TransactionStatus({ state, explorerUrl }: TransactionStatusProps) {
  if (state.status === "idle") return null;

  return (
    <div
      className={`
        mt-4 rounded-sm border p-5 text-[13px] font-sans leading-relaxed
        ${statusStyles[state.status]}
      `}
    >
      {/* ── Icon + message ── */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">{statusIcons[state.status]}</span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <p className="font-medium tracking-wide">
            {statusMessages[state.status]}
          </p>

          {/* Transaction hash */}
          {state.hash && (
            <p className="text-text-tertiary">
              Tx:{" "}
              {explorerUrl ? (
                <a
                  href={`${explorerUrl}/tx/${state.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-accent transition-colors duration-200"
                >
                  {truncateHash(state.hash)}
                </a>
              ) : (
                <span className="font-mono">{truncateHash(state.hash)}</span>
              )}
            </p>
          )}

          {/* Error message */}
          {state.status === "error" && state.error && (
            <p className="text-[12px] text-red-400/90 break-words">
              {state.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status → Style mapping
// ---------------------------------------------------------------------------

const statusStyles: Record<TransactionState["status"], string> = {
  idle: "",
  pendingSignature: "border-accent/30 bg-accent-muted/30 text-accent",
  confirming: "border-accent/30 bg-accent-muted/30 text-accent",
  success: "border-green-500/30 bg-green-500/5 text-green-400",
  error: "border-red-500/30 bg-red-500/5 text-red-400",
};

// ---------------------------------------------------------------------------
// Status → Message mapping
// ---------------------------------------------------------------------------

const statusMessages: Record<TransactionState["status"], string> = {
  idle: "",
  pendingSignature: "Waiting for wallet signature…",
  confirming: "Transaction submitted — confirming on-chain…",
  success: "Transaction confirmed.",
  error: "Transaction failed.",
};

// ---------------------------------------------------------------------------
// Status → Icon mapping (inline SVGs, no external deps)
// ---------------------------------------------------------------------------

const statusIcons: Record<TransactionState["status"], React.ReactNode> = {
  idle: null,

  pendingSignature: (
    <svg className="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),

  confirming: (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),

  success: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  error: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};
