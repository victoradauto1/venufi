"use client";

import { useState, useCallback, useEffect } from "react";
import type { Address } from "viem";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  useVenueState,
  useVenueFundingGoal,
  useVenueCurrentRaised,
  useVenueUserShares,
  VenueState,
  VENUE_STATE_LABELS,
  type VenueStateValue,
} from "@/hooks/web3/useVenue";
import { useInvest } from "@/hooks/web3/useVenueWrite";
import { formatEth, computeFundingPercent } from "@/lib/format";
import { Stat } from "../../../components/Stat";
import { TransactionButton } from "@/components/tx/TransactionButton";
import { TransactionStatus } from "@/components/tx/TransactionStatus";
import { IDLE_TX_STATE, type TransactionState } from "@/types/transaction";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = "https://sepolia.etherscan.io";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the share percentage the user would receive for a given ETH input.
 * share% = (inputWei / (currentRaised + inputWei)) * 100
 *
 * Uses pure bigint arithmetic to avoid unsafe Number conversion of large values.
 * Returns a string with 1 decimal place (e.g. "12.3").
 */
function computeSharePreview(
  inputEth: string,
  currentRaised: bigint | undefined,
  fundingGoal: bigint | undefined,
): string {
  if (fundingGoal == null || currentRaised == null) return "0.0";

  // Parse the user input string directly to wei — avoids float intermediaries
  const trimmed = inputEth.trim();
  if (trimmed === "" || trimmed === "0") return "0.0";

  let inputWei: bigint;
  try {
    inputWei = parseEther(trimmed);
  } catch {
    return "0.0";
  }

  if (inputWei <= 0n) return "0.0";

  const totalAfter = currentRaised + inputWei;
  if (totalAfter === 0n) return "0.0";

  // Scale by 1000 to get one decimal of precision: (input * 1000) / total
  // e.g. 12.3% → permille = 123n
  const permille = (inputWei * 1000n) / totalAfter;

  // Format: integer part + "." + single decimal digit
  const whole = permille / 10n;
  const frac = permille % 10n;
  return `${whole}.${frac < 0n ? -frac : frac}`;
}

/**
 * Returns true when ethAmount represents a valid, positive number.
 */
function isValidEthAmount(ethAmount: string): boolean {
  if (ethAmount.trim() === "") return false;
  const n = Number(ethAmount);
  return Number.isFinite(n) && n > 0;
}

/**
 * Converts a wagmi/viem error into a concise, user-friendly message.
 */
function humanizeError(err: unknown): string {
  if (err == null) return "An unknown error occurred.";

  const message =
    typeof err === "object" && "shortMessage" in err
      ? String((err as { shortMessage: unknown }).shortMessage)
      : err instanceof Error
        ? err.message
        : String(err);

  // Common patterns
  if (/user rejected|user denied/i.test(message)) {
    return "Transaction rejected — you declined the wallet signature.";
  }
  if (/insufficient funds/i.test(message)) {
    return "Insufficient funds — your wallet balance is too low.";
  }
  if (/exceeds balance/i.test(message)) {
    return "Insufficient funds — the amount exceeds your wallet balance.";
  }
  // Trim overly long messages
  if (message.length > 160) {
    return message.slice(0, 157) + "…";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InvestContentProps {
  venueAddress: string;
}

export function InvestContent({ venueAddress }: InvestContentProps) {
  const address = venueAddress as Address;
  const { address: userAddress, isConnected } = useAccount();

  // ── On-chain reads ────────────────────────────────────────────────────
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading } = useVenueCurrentRaised(address);
  const { data: userShares } = useVenueUserShares(address, userAddress);

  const isLoading = stateLoading || goalLoading || raisedLoading;

  // ── Write hook ────────────────────────────────────────────────────────
  const {
    invest,
    txHash,
    isConfirming,
    isConfirmed,
    isError,
    error: writeError,
    reset,
  } = useInvest(address);

  // ── Transaction UX state ──────────────────────────────────────────────
  //
  // Bridge wagmi's reactive booleans into a single TransactionState that
  // drives the reusable TransactionStatus + TransactionButton components.
  //
  // This same pattern should be replicated for every future write page:
  //   1. Destructure the write hook (txHash, isConfirming, isConfirmed, isError, error, reset)
  //   2. useState<TransactionState>(IDLE_TX_STATE)
  //   3. useEffect to sync wagmi → TransactionState
  //   4. handleX sets pendingSignature, calls write, catches to error
  //   5. useEffect to clear input on success
  //
  const [tx, setTx] = useState<TransactionState>(IDLE_TX_STATE);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setTx({ status: "success", hash: txHash });
    } else if (isConfirming && txHash) {
      setTx({ status: "confirming", hash: txHash });
    } else if (isError) {
      setTx({
        status: "error",
        hash: txHash ?? undefined,
        error: humanizeError(writeError),
      });
    }
  }, [isConfirmed, isConfirming, isError, txHash, writeError]);

  // ── Derived values ────────────────────────────────────────────────────
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";

  const goalEth = fundingGoal != null ? formatEth(fundingGoal as bigint) : "—";
  const raisedEth = currentRaised != null ? formatEth(currentRaised as bigint) : "—";
  const userSharesEth = userShares != null ? formatEth(userShares as bigint) : "0";

  const fundingPercent =
    fundingGoal != null && currentRaised != null
      ? computeFundingPercent(currentRaised as bigint, fundingGoal as bigint)
      : 0;

  // ── Investment form state ─────────────────────────────────────────────
  const [ethAmount, setEthAmount] = useState("");
  const parsed = parseFloat(ethAmount) || 0;
  const sharePercent = computeSharePreview(
    ethAmount,
    currentRaised as bigint | undefined,
    fundingGoal as bigint | undefined,
  );

  // ── Validation ────────────────────────────────────────────────────────
  const isValidAmount = isValidEthAmount(ethAmount);
  const isFundingPhase = venueState === VenueState.FUNDING;
  const isTxInProgress = tx.status === "pendingSignature" || tx.status === "confirming";
  const canInvest = isConnected && isValidAmount && isFundingPhase && !isTxInProgress;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleInvest = useCallback(async () => {
    if (!canInvest) return;

    // Reset any previous state
    reset();
    setTx({ status: "pendingSignature" });

    try {
      const value = parseEther(ethAmount);
      await invest(value);
      // wagmi hooks will drive the rest via the useEffect sync above
    } catch (err: unknown) {
      setTx({
        status: "error",
        error: humanizeError(err),
      });
    }
  }, [canInvest, ethAmount, invest, reset]);

  // Clear input after success
  useEffect(() => {
    if (tx.status === "success") {
      setEthAmount("");
    }
  }, [tx.status]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
        {/* Venue card skeleton */}
        <div className="w-full lg:flex-1 rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-pulse">
          <div className="flex items-center justify-between mb-7">
            <div className="h-6 w-40 rounded bg-border/50" />
            <div className="h-7 w-20 rounded bg-border/50" />
          </div>
          <div className="h-px w-full bg-border mb-7" />
          <div className="grid grid-cols-2 gap-7">
            <div>
              <div className="h-4 w-24 rounded bg-border/50 mb-2" />
              <div className="h-6 w-16 rounded bg-border/50" />
            </div>
            <div>
              <div className="h-4 w-24 rounded bg-border/50 mb-2" />
              <div className="h-6 w-16 rounded bg-border/50" />
            </div>
          </div>
          <div className="mt-7 h-px w-full bg-border" />
          <div className="mt-2.5 h-4 w-20 rounded bg-border/50 ml-auto" />
        </div>

        {/* Form skeleton */}
        <div className="w-full lg:flex-1 flex flex-col gap-8 animate-pulse">
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="h-4 w-28 rounded bg-border/50 mb-7" />
            <div className="h-4 w-32 rounded bg-border/50 mb-2.5" />
            <div className="h-12 w-full rounded bg-border/50" />
            <div className="mt-7 h-12 w-full rounded bg-border/50" />
          </div>
          <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
            <div className="h-4 w-40 rounded bg-border/50 mb-5" />
            <div className="h-8 w-32 rounded bg-border/50" />
          </div>
        </div>
      </section>
    );
  }

  // ── Loaded state ──────────────────────────────────────────────────────
  return (
    <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
      {/* ─── Venue Information Card ─── */}
      <div className="w-full lg:flex-1 rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-[21px] font-light text-text-primary font-serif tracking-wide">
            Historic Cultural Venue
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-muted px-3.5 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase text-accent font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {stateLabel}
          </span>
        </div>

        <div className="h-px w-full bg-border mb-7" />

        <div className="grid grid-cols-2 gap-7">
          <Stat label="Funding Goal" value={`${goalEth} ETH`} />
          <Stat label="Total Raised" value={`${raisedEth} ETH`} />
        </div>

        <div className="mt-7 h-px w-full bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${fundingPercent}%` }}
          />
        </div>
        <p className="mt-2.5 text-right text-[13px] text-text-tertiary font-sans tracking-wide">
          {fundingPercent}% funded
        </p>

        <div className="mt-7 h-px w-full bg-border" />

        <div className="mt-7 grid grid-cols-2 gap-7">
          <div>
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Your Shares
            </p>
            <p className="text-xl font-light text-text-primary font-serif tracking-tight">
              {userSharesEth} ETH
            </p>
          </div>
          <div>
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Investor Revenue Model
            </p>
            <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
              Revenue distributed proportionally to shares
            </p>
          </div>
        </div>
      </div>

      {/* ─── Investment Form + Preview ─── */}
      <div className="w-full lg:flex-1 flex flex-col gap-8">
        {/* ─── Form Card ─── */}
        <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
            Investment
          </h3>

          <label
            htmlFor="eth-amount"
            className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
          >
            Amount (ETH)
          </label>
          <input
            id="eth-amount"
            type="number"
            min="0"
            step="0.01"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            placeholder="Enter ETH amount"
            disabled={isTxInProgress}
            className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-60"
          />

          {/* Contextual helper text */}
          {!isConnected ? (
            <p className="mt-2.5 text-[13px] text-amber-500/80 font-sans font-light">
              Connect your wallet to invest.
            </p>
          ) : !isFundingPhase ? (
            <p className="mt-2.5 text-[13px] text-text-tertiary/80 font-sans font-light">
              This venue is no longer accepting investments.
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
              Shares are proportional to invested ETH.
            </p>
          )}

          <div className="mt-7">
            <TransactionButton
              onClick={handleInvest}
              disabled={!canInvest}
              loading={isTxInProgress}
            >
              <InvestIcon />
              {isTxInProgress ? "Investing…" : "Invest"}
            </TransactionButton>
          </div>

          <TransactionStatus state={tx} explorerUrl={EXPLORER_URL} />
        </div>

        {/* ─── Transaction Preview ─── */}
        <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
            Transaction Preview
          </h3>

          <p className="text-[13px] text-text-tertiary mb-4 font-sans tracking-wide uppercase">
            You will receive:
          </p>

          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-light text-text-primary font-serif tracking-tight">
              {parsed > 0 ? parsed.toFixed(4) : "0"} ETH
            </span>
            <span className="text-[15px] text-accent font-sans font-medium">
              → {sharePercent}% share
            </span>
          </div>

          <div className="mt-5 h-px w-full bg-border" />

          <p className="mt-4 text-[12px] text-text-tertiary/70 font-sans italic">
            Preview based on current on-chain funding data.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function InvestIcon() {
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
      <line x1="12" y1="1" x2="12" y2="23" />
      <polyline points="17 18 12 23 7 18" />
      <path d="M21 12H3" />
    </svg>
  );
}
