"use client";

import { useState, useCallback, useEffect } from "react";
import type { Address } from "viem";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  useVenueName,
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
import {
  TransactionReceipt,
  type ReceiptRow,
  type ReceiptAction,
} from "@/components/tx/TransactionReceipt";
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
// Investment Snapshot — captures values at submit time for the receipt
// ---------------------------------------------------------------------------

interface InvestmentSnapshot {
  venueName: string;
  ethAmount: string;
  venueAddress: string;
  /** Present only when the investment was partially accepted */
  partial?: {
    accepted: string;
    refunded: string;
  };
  /** True when this investment caused the funding goal to be fully reached,
   *  triggering the automatic FUNDING → ACTIVE transition. */
  goalReached: boolean;
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
  const { data: nameRaw, isLoading: nameLoading } = useVenueName(address);
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading } = useVenueCurrentRaised(address);
  const { data: userShares } = useVenueUserShares(address, userAddress);

  const isLoading = nameLoading || stateLoading || goalLoading || raisedLoading;

  const venueName = (typeof nameRaw === "string" && nameRaw.trim().length > 0)
    ? nameRaw.trim()
    : "VenueFi Campaign";

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

  // ── Investment snapshot (captures form values for the success receipt) ──
  const [investmentSnapshot, setInvestmentSnapshot] = useState<InvestmentSnapshot | null>(null);

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

  const remainingFunding =
    fundingGoal != null && currentRaised != null
      ? (fundingGoal as bigint) - (currentRaised as bigint)
      : undefined;
  const remainingEth = remainingFunding != null ? formatEth(remainingFunding) : "—";

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

  // ── Partial-refund detection ───────────────────────────────────────────
  const exceedsRemaining = (() => {
    if (!isValidAmount || remainingFunding == null) return false;
    try {
      return parseEther(ethAmount.trim()) > remainingFunding;
    } catch {
      return false;
    }
  })();
  const acceptedEth = remainingFunding != null ? formatEth(remainingFunding) : "0";
  const refundEth = (() => {
    if (!exceedsRemaining || remainingFunding == null) return "0";
    try {
      return formatEth(parseEther(ethAmount.trim()) - remainingFunding);
    } catch {
      return "0";
    }
  })();

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleInvest = useCallback(async () => {
    if (!canInvest) return;

    // Reset any previous state
    reset();
    setTx({ status: "pendingSignature" });

    // Determine whether this investment will complete the funding goal.
    // If partial: accepted == remaining → goal exactly reached.
    // If full: inputWei >= remaining → goal reached.
    const willReachGoal = (() => {
      if (fundingGoal == null || currentRaised == null) return false;
      try {
        const inputWei = parseEther(ethAmount.trim());
        const remaining = (fundingGoal as bigint) - (currentRaised as bigint);
        return inputWei >= remaining && remaining > 0n;
      } catch {
        return false;
      }
    })();

    setInvestmentSnapshot({
      venueName,
      ethAmount: ethAmount.trim(),
      venueAddress,
      goalReached: willReachGoal,
      ...(exceedsRemaining && {
        partial: {
          accepted: acceptedEth,
          refunded: refundEth,
        },
      }),
    });

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
  }, [canInvest, ethAmount, invest, reset, venueName, venueAddress, exceedsRemaining, acceptedEth, refundEth]);

  // Clear input after success
  useEffect(() => {
    if (tx.status === "success") {
      setEthAmount("");
    }
  }, [tx.status]);

  // ── "Make Another Investment" handler ─────────────────────────────────
  const handleInvestAnother = useCallback(() => {
    reset();
    setTx(IDLE_TX_STATE);
    setInvestmentSnapshot(null);
    setEthAmount("");
  }, [reset]);

  // ── Derived: show success receipt? ────────────────────────────────────
  const showReceipt = tx.status === "success" && investmentSnapshot !== null;

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

  // ── Investment Receipt ────────────────────────────────────────────────
  if (showReceipt) {
    const receiptRows: ReceiptRow[] = [
      {
        label: "Venue Name",
        value: investmentSnapshot.venueName,
        fullWidth: true,
      },
      // Partial investment: show requested / accepted / refunded
      // Full investment: show single "Investment Amount"
      ...(investmentSnapshot.partial
        ? [
            {
              label: "Requested Amount",
              value: `${investmentSnapshot.ethAmount} ETH`,
            },
            {
              label: "Accepted Amount",
              value: `${investmentSnapshot.partial.accepted} ETH`,
              highlight: true,
            },
            {
              label: "Refunded Amount",
              value: `${investmentSnapshot.partial.refunded} ETH`,
            },
          ]
        : [
            {
              label: "Investment Amount",
              value: `${investmentSnapshot.ethAmount} ETH`,
              highlight: true,
            },
          ]),
      {
        label: "Network",
        value: "Sepolia",
      },
      {
        label: "Venue Contract",
        value: investmentSnapshot.venueAddress,
        fullWidth: true,
        mono: true,
      },
      {
        label: "Confirmation Status",
        value: "Confirmed ✓",
      },
    ];

    const goalReached = investmentSnapshot.goalReached;

    const receiptActions: ReceiptAction[] = [
      {
        label: goalReached ? "View Active Venue →" : "View Venue →",
        href: `/venue/${venueAddress}`,
        primary: true,
      },
      ...(goalReached
        ? [
            {
              label: "Go to Revenue",
              href: `/venue/${venueAddress}/revenue`,
            },
          ]
        : []),
      {
        label: "Browse Venues",
        href: "/venues",
      },
      {
        label: "Make Another Investment",
        onClick: handleInvestAnother,
      },
    ];

    return (
      <TransactionReceipt
        title="Investment Successfully Confirmed"
        subtitle={
          goalReached
            ? "Congratulations! Your investment completed the funding round. The venue is now ACTIVE."
            : "Thank you for supporting this venue. Your investment has been recorded on-chain."
        }
        receiptHeading="Investment Receipt"
        rows={receiptRows}
        txHash={tx.hash}
        whatsNext={
          goalReached
            ? [
                "The funding round is complete — the venue is now in the ACTIVE phase.",
                "The operator can now withdraw capital and begin revenue operations.",
                "You are eligible to claim revenue distributions as they are deposited.",
              ]
            : [
                "Your funds are now locked in the funding campaign.",
                "Once the funding goal is reached, the venue enters the ACTIVE phase.",
                "During the ACTIVE phase you'll become eligible to claim revenue distributions.",
              ]
        }
        actions={receiptActions}
      >
        {goalReached && (
          <div className="mt-7 rounded-sm border border-accent/30 bg-accent-muted/40 px-6 py-5">
            <p className="text-[13px] font-semibold tracking-[0.1em] uppercase text-accent font-sans mb-2">
              Funding Goal Reached
            </p>
            <p className="text-[14px] text-text-secondary font-sans font-light leading-relaxed">
              This investment completed the fundraising campaign.
              The venue has automatically entered the <span className="font-medium text-accent">ACTIVE</span> phase.
            </p>
          </div>
        )}
      </TransactionReceipt>
    );
  }

  // ── Loaded state ──────────────────────────────────────────────────────
  return (
    <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
      {/* ─── Venue Information Card ─── */}
      <div className="w-full lg:flex-1 rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-[21px] font-light text-text-primary font-serif tracking-wide">
            {venueName}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-muted px-3.5 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase text-accent font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {stateLabel}
          </span>
        </div>

        <div className="h-px w-full bg-border mb-7" />

        <div className="grid grid-cols-3 gap-7">
          <Stat label="Funding Goal" value={`${goalEth} ETH`} />
          <Stat label="Total Raised" value={`${raisedEth} ETH`} />
          <Stat label="Remaining Capacity" value={`${remainingEth} ETH`} />
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

          {/* Partial-refund warning */}
          {exceedsRemaining && (
            <div className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/5 px-5 py-4">
              <p className="text-[13px] text-amber-400 font-sans font-medium mb-1.5">
                Partial Investment Notice
              </p>
              <p className="text-[13px] text-amber-400/80 font-sans font-light leading-relaxed">
                You entered{" "}
                <span className="font-medium text-amber-300">
                  {ethAmount.trim()} ETH
                </span>
                . Only{" "}
                <span className="font-medium text-amber-300">
                  {acceptedEth} ETH
                </span>{" "}
                can still be invested. The remaining{" "}
                <span className="font-medium text-amber-300">
                  {refundEth} ETH
                </span>{" "}
                will be automatically refunded.
              </p>
            </div>
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
