"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Address } from "viem";
import { parseEther, parseAbiItem, formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { publicClient } from "@/lib/wagmi";
import {
  useVenueName,
  useVenueState,
  useVenueFundingGoal,
  useVenueCurrentRaised,
  useVenueUserShares,
  useVenuePending,
  useVenueDeadline,
  VenueState,
  VENUE_STATE_LABELS,
  type VenueStateValue,
} from "@/hooks/web3/useVenue";
import { useInvest } from "@/hooks/web3/useVenueWrite";
import { venueFiAbi } from "@/lib/contracts/venueFi";
import { formatEth, computeFundingPercent } from "@/lib/format";
import { TransactionButton } from "@/components/tx/TransactionButton";
import { TransactionStatus } from "@/components/tx/TransactionStatus";
import {
  TransactionReceipt,
  type ReceiptRow,
  type ReceiptAction,
} from "@/components/tx/TransactionReceipt";
import { IDLE_TX_STATE, type TransactionState } from "@/types/transaction";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = "https://sepolia.etherscan.io";

/**
 * Formats a bigint wei value to a trimmed ETH string.
 * Inline helper to avoid coupling to shared formatEth for analytics-only usage.
 */
function formatEthSafe(wei: bigint): string {
  const raw = formatEther(wei);
  if (raw.includes(".")) {
    const trimmed = raw.replace(/\.?0+$/, "");
    return trimmed || "0";
  }
  return raw;
}

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
// Countdown helper
// ---------------------------------------------------------------------------

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  totalSeconds: number;
}

function computeCountdown(deadlineUnix: number): CountdownResult {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadlineUnix - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, totalSeconds: 0 };
  }
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    expired: false,
    totalSeconds: diff,
  };
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
  const { data: stateRaw, isLoading: stateLoading, refetch: refetchState } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading, refetch: refetchGoal } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading, refetch: refetchRaised } = useVenueCurrentRaised(address);
  const { data: userShares, refetch: refetchShares } = useVenueUserShares(address, userAddress);
  const { data: deadlineRaw } = useVenueDeadline(address);

  // ── "Your Investment" card reads ─────────────────────────────────────
  const { data: totalSupply } = useReadContract({
    address,
    abi: venueFiAbi,
    functionName: "totalSupply",
    query: { enabled: !!address },
  });
  const { data: pendingRevenue } = useVenuePending(address, userAddress);

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
      // Refetch all on-chain data so the receipt renders the latest state.
      // We intentionally avoid setting success until refetches settle.
      let cancelled = false;
      Promise.all([
        refetchRaised(),
        refetchGoal(),
        refetchState(),
        refetchShares(),
      ]).finally(() => {
        if (!cancelled) {
          setTx({ status: "success", hash: txHash });
        }
      });
      return () => { cancelled = true; };
    } else if (isConfirming && txHash) {
      setTx({ status: "confirming", hash: txHash });
    } else if (isError) {
      setTx({
        status: "error",
        hash: txHash ?? undefined,
        error: humanizeError(writeError),
      });
    }
  }, [isConfirmed, isConfirming, isError, txHash, writeError, refetchRaised, refetchGoal, refetchState, refetchShares]);

  // ── Derived values ────────────────────────────────────────────────────
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";

  const goalEth = fundingGoal != null ? formatEth(fundingGoal as bigint) : "—";
  const raisedEth = currentRaised != null ? formatEth(currentRaised as bigint) : "—";
  const userSharesEth = userShares != null ? formatEth(userShares as bigint) : "0";

  // ── "Your Investment" derived values ───────────────────────────────────
  const userSharesBigint = (userShares as bigint | undefined) ?? 0n;
  const totalSupplyBigint = (totalSupply as bigint | undefined) ?? 0n;
  const hasShares = userSharesBigint > 0n;

  const ownershipPercent =
    hasShares && totalSupplyBigint > 0n
      ? ((userSharesBigint * 10000n) / totalSupplyBigint)
      : 0n;
  // Format: "12.34" — two decimal places via bigint permyriad
  const ownershipDisplay = `${ownershipPercent / 100n}.${String(ownershipPercent % 100n).padStart(2, "0")}`;

  const pendingRevenueEth =
    pendingRevenue != null ? formatEth(pendingRevenue as bigint) : "0";

  const remainingFunding =
    fundingGoal != null && currentRaised != null
      ? (fundingGoal as bigint) - (currentRaised as bigint)
      : undefined;
  const remainingEth = remainingFunding != null ? formatEth(remainingFunding) : "—";

  const fundingPercent =
    fundingGoal != null && currentRaised != null
      ? computeFundingPercent(currentRaised as bigint, fundingGoal as bigint)
      : 0;

  // ── Deadline / Countdown ───────────────────────────────────────────────
  const deadlineUnix = deadlineRaw != null ? Number(deadlineRaw) : 0;

  const [countdown, setCountdown] = useState<CountdownResult>(() =>
    deadlineUnix > 0 ? computeCountdown(deadlineUnix) : { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, totalSeconds: 0 }
  );

  useEffect(() => {
    if (deadlineUnix <= 0) return;
    // Immediately compute once
    setCountdown(computeCountdown(deadlineUnix));
    const interval = setInterval(() => {
      const next = computeCountdown(deadlineUnix);
      setCountdown(next);
      if (next.expired) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineUnix]);

  // Hero status badge config
  const heroBadge = useMemo(() => {
    if (venueState === VenueState.ACTIVE) {
      return { label: "Active", color: "var(--success)", bg: "rgba(183, 155, 108, 0.12)" };
    }
    if (venueState === VenueState.ENDED || (venueState === VenueState.FUNDING && countdown.expired)) {
      return { label: "Funding Closed", color: "var(--text-tertiary)", bg: "rgba(112, 107, 101, 0.10)" };
    }
    return { label: "Funding Open", color: "#C4943D", bg: "rgba(196, 148, 61, 0.12)" };
  }, [venueState, countdown.expired]);

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

  // ── Campaign Analytics (on-chain event logs) ─────────────────────────
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [investedLogs, setInvestedLogs] = useState<{ investor: string; amount: bigint }[]>([]);
  const [depositedLogs, setDepositedLogs] = useState<{ amount: bigint }[]>([]);
  const [claimedLogs, setClaimedLogs] = useState<{ amount: bigint }[]>([]);

  // ── Timeline raw logs (keep block metadata for the activity feed) ────
  type TimelineRawLog = {
    eventName: string;
    blockNumber: bigint;
    transactionHash: string;
    args: Record<string, unknown>;
  };
  const [timelineLogs, setTimelineLogs] = useState<TimelineRawLog[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      try {
        const [invested, deposited, claimed, partialAccepted, stateChanged] = await Promise.all([
          publicClient.getLogs({
            address: address,
            event: parseAbiItem("event Invested(address indexed investor, uint256 amount)"),
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: address,
            event: parseAbiItem("event Deposited(address indexed depositor, uint256 amount)"),
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: address,
            event: parseAbiItem("event Claimed(address indexed user, uint256 amount)"),
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: address,
            event: parseAbiItem("event PartialInvestmentAccepted(address indexed investor, uint256 requested, uint256 accepted, uint256 refunded)"),
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: address,
            event: parseAbiItem("event StateChanged(uint8 newState)"),
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        if (cancelled) return;

        setInvestedLogs(
          invested.map((log) => ({
            investor: (log.args as { investor: string }).investor,
            amount: (log.args as { amount: bigint }).amount,
          }))
        );
        setDepositedLogs(
          deposited.map((log) => ({
            amount: (log.args as { amount: bigint }).amount,
          }))
        );
        setClaimedLogs(
          claimed.map((log) => ({
            amount: (log.args as { amount: bigint }).amount,
          }))
        );

        // Build unified timeline array
        const rawTimeline: TimelineRawLog[] = [
          ...invested.map((log) => ({
            eventName: "Invested" as const,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: log.args as Record<string, unknown>,
          })),
          ...deposited.map((log) => ({
            eventName: "Deposited" as const,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: log.args as Record<string, unknown>,
          })),
          ...claimed.map((log) => ({
            eventName: "Claimed" as const,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: log.args as Record<string, unknown>,
          })),
          ...partialAccepted.map((log) => ({
            eventName: "PartialInvestmentAccepted" as const,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: log.args as Record<string, unknown>,
          })),
          ...stateChanged.map((log) => ({
            eventName: "StateChanged" as const,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: log.args as Record<string, unknown>,
          })),
        ];
        setTimelineLogs(rawTimeline);
      } catch {
        // Silently handle — analytics are non-critical
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }

    fetchLogs();
    return () => { cancelled = true; };
  }, [address]);

  const analytics = useMemo(() => {
    const uniqueInvestors = new Set(investedLogs.map((l) => l.investor.toLowerCase()));
    const totalInvestors = uniqueInvestors.size;

    const totalInvestedWei = investedLogs.reduce((sum, l) => sum + l.amount, 0n);
    const largestInvestmentWei = investedLogs.reduce(
      (max, l) => (l.amount > max ? l.amount : max),
      0n
    );
    const averageInvestmentWei =
      totalInvestors > 0 ? totalInvestedWei / BigInt(totalInvestors) : 0n;

    const revenueDistributedWei = depositedLogs.reduce((sum, l) => sum + l.amount, 0n);
    const revenueClaimedWei = claimedLogs.reduce((sum, l) => sum + l.amount, 0n);
    const totalClaims = claimedLogs.length;

    return {
      totalInvestors,
      largestInvestment: formatEthSafe(largestInvestmentWei),
      averageInvestment: formatEthSafe(averageInvestmentWei),
      revenueDistributed: formatEthSafe(revenueDistributedWei),
      revenueClaimed: formatEthSafe(revenueClaimedWei),
      totalClaims,
      hasActivity: investedLogs.length > 0 || depositedLogs.length > 0 || claimedLogs.length > 0,
    };
  }, [investedLogs, depositedLogs, claimedLogs]);

  // ── Loaded state ──────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* ─── Funding Status Hero ─── */}
      <section
        className="relative mx-auto max-w-3xl px-6 pt-4 pb-16 text-center"
        style={{ marginBottom: "1rem" }}
      >
        {/* Status Badge */}
        <div className="flex justify-center mb-8">
          <span
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase font-sans"
            style={{
              color: heroBadge.color,
              backgroundColor: heroBadge.bg,
              border: `1px solid ${heroBadge.color}22`,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: heroBadge.color }}
            />
            {heroBadge.label}
          </span>
        </div>

        {/* Venue Name */}
        <h1
          className="font-serif font-light tracking-wide leading-tight text-text-primary"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
        >
          {venueName}
        </h1>

        {/* Divider accent line */}
        <div
          className="mx-auto mt-6 mb-10"
          style={{
            width: "48px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
          }}
        />

        {/* Funding Percentage */}
        <p
          className="font-serif font-light leading-none tracking-tight"
          style={{
            fontSize: "clamp(3.5rem, 8vw, 5rem)",
            color:
              venueState === VenueState.ACTIVE
                ? "var(--success)"
                : fundingPercent >= 100
                  ? "var(--success)"
                  : fundingPercent >= 70
                    ? "#D4A849"
                    : "var(--accent)",
          }}
        >
          {venueState === VenueState.ACTIVE ? "100" : fundingPercent}%
        </p>

        {/* Raised of Goal */}
        <p className="mt-4 text-[16px] text-text-secondary font-sans font-light tracking-wide">
          <span className="font-medium text-text-primary">{raisedEth} ETH</span>{" "}
          raised of{" "}
          <span className="font-medium text-text-primary">{goalEth} ETH</span>
        </p>

        {/* Remaining */}
        {venueState !== VenueState.ACTIVE && (
          <p className="mt-2 text-[14px] text-text-tertiary font-sans font-light tracking-wide">
            {remainingEth} ETH remaining
          </p>
        )}

        {/* Countdown */}
        <div className="mt-10">
          {venueState === VenueState.ACTIVE ? (
            <p className="text-[13px] tracking-[0.25em] uppercase font-sans font-semibold" style={{ color: "var(--success)" }}>
              Funding Successfully Completed
            </p>
          ) : countdown.expired ? (
            <p className="text-[13px] tracking-[0.25em] uppercase font-sans font-semibold text-text-tertiary">
              Funding Closed
            </p>
          ) : (
            <>
              <p className="text-[11px] tracking-[0.3em] uppercase text-text-tertiary font-sans mb-3">
                Funding ends in
              </p>
              <div className="flex justify-center gap-6">
                {[
                  { value: countdown.days, label: "Days" },
                  { value: countdown.hours, label: "Hours" },
                  { value: countdown.minutes, label: "Min" },
                  { value: countdown.seconds, label: "Sec" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span
                      className="font-serif font-light tracking-tight leading-none"
                      style={{ fontSize: "1.75rem", color: "var(--text-primary)" }}
                    >
                      {String(value).padStart(2, "0")}
                    </span>
                    <span className="mt-1.5 text-[10px] tracking-[0.2em] uppercase text-text-tertiary font-sans">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom decorative line */}
        <div
          className="mx-auto mt-12"
          style={{
            width: "100%",
            maxWidth: "280px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, var(--border), transparent)",
          }}
        />
      </section>

      {/* ─── Campaign Analytics ─── */}
      {(venueState === VenueState.FUNDING || venueState === VenueState.ACTIVE) && (
        <CampaignAnalytics
          loading={analyticsLoading}
          analytics={analytics}
          fundingPercent={fundingPercent}
          raisedEth={raisedEth}
          venueState={venueState}
        />
      )}

      {/* ─── Campaign Activity Timeline ─── */}
      {(venueState === VenueState.FUNDING || venueState === VenueState.ACTIVE) && (
        <CampaignActivityTimeline
          loading={analyticsLoading}
          logs={timelineLogs}
        />
      )}

    {venueState === VenueState.ACTIVE ? (
      <ActiveDashboard
        venueName={venueName}
        raisedEth={raisedEth}
        goalEth={goalEth}
        userSharesEth={userSharesEth}
        ownershipDisplay={ownershipDisplay}
        pendingRevenueEth={pendingRevenueEth}
        hasShares={hasShares}
        isConnected={isConnected}
        venueAddress={venueAddress}
      />
    ) : (
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

        {/* ─── Funding Progress ─── */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary font-sans">
            Funding Progress
          </p>

          <p
            className="text-[48px] font-light font-serif tracking-tight leading-none"
            style={{
              color:
                fundingPercent >= 100
                  ? "var(--success)"
                  : fundingPercent >= 70
                    ? "#D4A849"
                    : "var(--accent)",
            }}
          >
            {fundingPercent}%
          </p>

          {/* Progress bar */}
          <div className="w-full mt-1">
            <div
              className="funding-progress-track"
              role="progressbar"
              aria-valuenow={fundingPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="funding-progress-fill"
                style={{
                  width: `${fundingPercent}%`,
                  background:
                    fundingPercent >= 100
                      ? "linear-gradient(90deg, var(--success), #c8b07a)"
                      : fundingPercent >= 70
                        ? "linear-gradient(90deg, #C4943D, #E8C96A, #D4A849)"
                        : "linear-gradient(90deg, var(--accent), #C4943D)",
                }}
              />
            </div>
          </div>

          {/* Raised / Remaining text */}
          <p className="text-[14px] text-text-secondary font-sans font-light">
            <span className="font-medium text-text-primary">{raisedEth} ETH</span>{" "}
            raised of{" "}
            <span className="font-medium text-text-primary">{goalEth} ETH</span>
          </p>
          <p className="text-[13px] text-text-tertiary font-sans font-light tracking-wide">
            {remainingEth} ETH remaining
          </p>
        </div>

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
        {/* ─── Your Investment Card (only when wallet holds shares) ─── */}
        {isConnected && hasShares && (
          <div className="rounded-sm border border-accent/25 bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
              Your Investment
            </h3>

            <div className="grid grid-cols-2 gap-7">
              {/* Your Shares */}
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Your Shares
                </p>
                <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                  {userSharesEth} ETH
                </p>
              </div>

              {/* Ownership % */}
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Ownership
                </p>
                <p className="text-xl font-light text-accent font-serif tracking-tight">
                  {ownershipDisplay}%
                </p>
              </div>

              {/* Current Funding Status */}
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Funding Status
                </p>
                <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                  {raisedEth}
                  <span className="text-[14px] text-text-tertiary font-sans font-light">
                    {" "}/{" "}{goalEth} ETH
                  </span>
                </p>
              </div>

              {/* Pending Revenue */}
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Pending Revenue
                </p>
                <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                  {pendingRevenueEth} ETH
                </p>
              </div>
            </div>
          </div>
        )}

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
    )}
    </div>
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

// ---------------------------------------------------------------------------
// Campaign Analytics
// ---------------------------------------------------------------------------

interface AnalyticsData {
  totalInvestors: number;
  largestInvestment: string;
  averageInvestment: string;
  revenueDistributed: string;
  revenueClaimed: string;
  totalClaims: number;
  hasActivity: boolean;
}

interface CampaignAnalyticsProps {
  loading: boolean;
  analytics: AnalyticsData;
  fundingPercent: number;
  raisedEth: string;
  venueState: VenueStateValue;
}

function CampaignAnalytics({
  loading,
  analytics,
  fundingPercent,
  raisedEth,
  venueState,
}: CampaignAnalyticsProps) {
  const cards = useMemo(() => {
    const isActive = venueState === VenueState.ACTIVE;
    return [
      {
        label: "Funding Progress",
        value: `${isActive ? 100 : fundingPercent}%`,
        accent: true,
      },
      {
        label: "Total Raised",
        value: `${raisedEth} ETH`,
      },
      {
        label: "Total Investors",
        value: String(analytics.totalInvestors),
      },
      {
        label: "Largest Investment",
        value: `${analytics.largestInvestment} ETH`,
      },
      {
        label: "Average Investment",
        value: `${analytics.averageInvestment} ETH`,
      },
      {
        label: "Revenue Distributed",
        value: `${analytics.revenueDistributed} ETH`,
      },
      {
        label: "Revenue Claimed",
        value: `${analytics.revenueClaimed} ETH`,
      },
      {
        label: "Total Claims",
        value: String(analytics.totalClaims),
      },
    ];
  }, [analytics, fundingPercent, raisedEth, venueState]);

  return (
    <section className="px-6 pb-10 max-w-5xl mx-auto w-full">
      <h2 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans text-center">
        Campaign Analytics
      </h2>

      {loading ? (
        /* Skeleton grid */
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm border border-border bg-surface p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-border/50 mb-4" />
              <div className="h-6 w-16 rounded bg-border/50" />
            </div>
          ))}
        </div>
      ) : !analytics.hasActivity ? (
        /* Empty state */
        <div className="rounded-sm border border-border bg-surface-raised/50 p-9 text-center">
          <p className="text-[14px] text-text-tertiary font-sans font-light">
            No campaign activity yet.
          </p>
        </div>
      ) : (
        /* Analytics cards */
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-sm border border-border bg-surface p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            >
              <p className="text-[11px] text-text-tertiary mb-2.5 font-sans tracking-[0.15em] uppercase">
                {card.label}
              </p>
              <p
                className="text-xl font-light font-serif tracking-tight"
                style={{
                  color: card.accent
                    ? fundingPercent >= 100
                      ? "var(--success)"
                      : fundingPercent >= 70
                        ? "#D4A849"
                        : "var(--accent)"
                    : "var(--text-primary)",
                }}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Section bottom divider */}
      <div
        className="mx-auto mt-10"
        style={{
          width: "100%",
          maxWidth: "280px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, var(--border), transparent)",
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Campaign Activity Timeline
// ---------------------------------------------------------------------------

/** Shortened address: 0x1234...89ab */
function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Shortened tx hash: 0xabcd…ef01 */
function shortenTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** Maps VenueFi enum index to human-readable label */
function stateIndexToLabel(index: number): string {
  switch (index) {
    case 0: return "FUNDING";
    case 1: return "ACTIVE";
    case 2: return "ENDED";
    default: return "UNKNOWN";
  }
}

/** Derives a descriptive title for a StateChanged event. */
function stateChangeTitle(newStateIndex: number): string {
  switch (newStateIndex) {
    case 1: return "Funding Goal Reached";
    case 2: return "Campaign Ended";
    default: return "State Changed";
  }
}

/** Derives a descriptive subtitle for a StateChanged event. */
function stateChangeSubtitle(newStateIndex: number): string {
  switch (newStateIndex) {
    case 1: return "Campaign automatically entered the ACTIVE phase.";
    case 2: return "The campaign has transitioned to the ENDED phase.";
    default: return `Campaign state changed to ${stateIndexToLabel(newStateIndex)}.`;
  }
}

interface TimelineEntry {
  icon: string;
  title: string;
  subtitle: string;
  amount?: string;
  blockNumber: bigint;
  transactionHash: string;
}

interface CampaignActivityTimelineProps {
  loading: boolean;
  logs: {
    eventName: string;
    blockNumber: bigint;
    transactionHash: string;
    args: Record<string, unknown>;
  }[];
}

function CampaignActivityTimeline({ loading, logs }: CampaignActivityTimelineProps) {
  const entries = useMemo<TimelineEntry[]>(() => {
    const mapped: TimelineEntry[] = logs.map((log) => {
      switch (log.eventName) {
        case "Invested": {
          const investor = String(log.args.investor ?? "");
          const amount = log.args.amount as bigint | undefined;
          return {
            icon: "💰",
            title: "Investment Received",
            subtitle: `${shortenAddress(investor)} invested in this venue.`,
            amount: amount != null ? `${formatEthSafe(amount)} ETH` : undefined,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
        }
        case "PartialInvestmentAccepted": {
          const investor = String(log.args.investor ?? "");
          return {
            icon: "↩️",
            title: "Partial Investment Accepted",
            subtitle: `Excess funds were automatically refunded to ${shortenAddress(investor)}.`,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
        }
        case "StateChanged": {
          const newState = Number(log.args.newState ?? 0);
          return {
            icon: "🔄",
            title: stateChangeTitle(newState),
            subtitle: stateChangeSubtitle(newState),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
        }
        case "Deposited": {
          const amount = log.args.amount as bigint | undefined;
          return {
            icon: "📥",
            title: "Revenue Deposited",
            subtitle: "Operator distributed new revenue.",
            amount: amount != null ? `${formatEthSafe(amount)} ETH` : undefined,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
        }
        case "Claimed": {
          const amount = log.args.amount as bigint | undefined;
          return {
            icon: "🎯",
            title: "Revenue Claimed",
            subtitle: "Investor claimed rewards.",
            amount: amount != null ? `${formatEthSafe(amount)} ETH` : undefined,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
        }
        default:
          return {
            icon: "📋",
            title: log.eventName,
            subtitle: "On-chain event.",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
      }
    });

    // Sort by blockNumber descending (newest first)
    mapped.sort((a, b) => {
      if (b.blockNumber > a.blockNumber) return 1;
      if (b.blockNumber < a.blockNumber) return -1;
      return 0;
    });

    return mapped;
  }, [logs]);

  return (
    <section className="px-6 pb-10 max-w-3xl mx-auto w-full" aria-label="Campaign Activity Timeline">
      <h2 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans text-center">
        Campaign Activity
      </h2>

      {loading ? (
        /* Skeleton timeline */
        <ol className="relative" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="relative" style={{ paddingLeft: "36px", paddingBottom: i < 4 ? "28px" : "0" }}>
              {/* Dot skeleton */}
              <span
                className="absolute animate-pulse"
                style={{
                  left: "0",
                  top: "6px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "var(--border)",
                }}
              />
              {/* Connector line skeleton */}
              {i < 4 && (
                <span
                  className="absolute"
                  style={{
                    left: "5px",
                    top: "22px",
                    width: "2px",
                    bottom: "0",
                    background: "var(--border)",
                    opacity: 0.4,
                  }}
                />
              )}
              {/* Card skeleton */}
              <div className="rounded-sm border border-border bg-surface p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-pulse">
                <div className="h-3 w-32 rounded bg-border/50 mb-3" />
                <div className="h-3 w-48 rounded bg-border/50 mb-3" />
                <div className="h-3 w-20 rounded bg-border/50" />
              </div>
            </li>
          ))}
        </ol>
      ) : entries.length === 0 ? (
        /* Empty state */
        <div className="rounded-sm border border-border bg-surface-raised/50 p-9 text-center">
          <p className="text-[14px] text-text-tertiary font-sans font-light">
            No campaign activity yet.
          </p>
        </div>
      ) : (
        /* Timeline list */
        <ol
          className="relative"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
          aria-label="Campaign activity events, newest first"
        >
          {entries.map((entry, i) => (
            <li
              key={`${entry.transactionHash}-${i}`}
              className="relative"
              style={{ paddingLeft: "36px", paddingBottom: i < entries.length - 1 ? "28px" : "0" }}
            >
              {/* Timeline dot */}
              <span
                className="absolute flex items-center justify-center"
                aria-hidden="true"
                style={{
                  left: "0",
                  top: "6px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), #C4943D)",
                  boxShadow: "0 0 0 3px var(--background), 0 0 0 4px var(--border)",
                }}
              />
              {/* Connector line */}
              {i < entries.length - 1 && (
                <span
                  className="absolute"
                  aria-hidden="true"
                  style={{
                    left: "5px",
                    top: "22px",
                    width: "2px",
                    bottom: "0",
                    background: "linear-gradient(180deg, var(--border), transparent)",
                  }}
                />
              )}
              {/* Event card */}
              <div className="rounded-sm border border-border bg-surface p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                {/* Header row: icon + title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <span style={{ fontSize: "16px", lineHeight: 1 }} aria-hidden="true">
                    {entry.icon}
                  </span>
                  <h3 className="text-[14px] font-medium text-text-primary font-sans tracking-wide">
                    {entry.title}
                  </h3>
                </div>

                {/* Subtitle */}
                <p className="text-[13px] text-text-secondary font-sans font-light leading-relaxed mb-3">
                  {entry.subtitle}
                </p>

                {/* Amount (when applicable) */}
                {entry.amount && (
                  <p className="text-xl font-light text-accent font-serif tracking-tight mb-3">
                    {entry.amount}
                  </p>
                )}

                {/* Metadata row */}
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-[11px] text-text-tertiary font-sans tracking-[0.1em] uppercase">
                    Block {entry.blockNumber.toString()}
                  </span>
                  <a
                    href={`${EXPLORER_URL}/tx/${entry.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-accent font-sans tracking-[0.05em] no-underline"
                    style={{ borderBottom: "1px solid transparent" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.borderBottomColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.borderBottomColor = "transparent"; }}
                  >
                    TX {shortenTxHash(entry.transactionHash)}
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Section bottom divider */}
      <div
        className="mx-auto mt-10"
        style={{
          width: "100%",
          maxWidth: "280px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, var(--border), transparent)",
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Active Dashboard — rendered when venueState === ACTIVE
// ---------------------------------------------------------------------------

interface ActiveDashboardProps {
  venueName: string;
  raisedEth: string;
  goalEth: string;
  userSharesEth: string;
  ownershipDisplay: string;
  pendingRevenueEth: string;
  hasShares: boolean;
  isConnected: boolean;
  venueAddress: string;
}

function ActiveDashboard({
  raisedEth,
  goalEth,
  userSharesEth,
  ownershipDisplay,
  pendingRevenueEth,
  hasShares,
  isConnected,
  venueAddress,
}: ActiveDashboardProps) {
  const hasPending = pendingRevenueEth !== "0" && pendingRevenueEth !== "0.0";

  return (
    <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
      {/* ─── Three-card grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1 — Campaign Summary */}
        <div className="rounded-sm border border-border bg-surface p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
            Campaign Summary
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Capital Raised
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {raisedEth} ETH
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Funding Goal
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {goalEth} ETH
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Funding Status
              </p>
              <p className="text-xl font-light font-serif tracking-tight" style={{ color: "var(--success)" }}>
                Completed
              </p>
            </div>
          </div>
        </div>

        {/* Card 2 — Your Position */}
        <div className="rounded-sm border border-accent/25 bg-surface p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
            Your Position
          </h3>
          {isConnected && hasShares ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Your Shares
                </p>
                <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                  {userSharesEth} ETH
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Ownership
                </p>
                <p className="text-xl font-light text-accent font-serif tracking-tight">
                  {ownershipDisplay}%
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Pending Revenue
                </p>
                <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                  {pendingRevenueEth} ETH
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Claim Status
                </p>
                {hasPending ? (
                  <p className="text-[15px] font-medium font-sans" style={{ color: "var(--success)" }}>
                    Available
                  </p>
                ) : (
                  <p className="text-[15px] font-light text-text-tertiary font-sans">
                    No revenue yet
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-text-tertiary font-sans font-light leading-relaxed">
              {isConnected ? "You have no shares in this venue." : "Connect your wallet to view your position."}
            </p>
          )}
        </div>

        {/* Card 3 — Revenue Distribution */}
        <div className="rounded-sm border border-border bg-surface p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
            Revenue Distribution
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Revenue Model
              </p>
              <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
                Pro-rata by shares
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Operator Fee
              </p>
              <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
                Protocol configured
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                Claim
              </p>
              <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
                Available after revenue deposits
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Info Panel ─── */}
      <div className="rounded-sm border border-border bg-surface-raised/50 p-9 mb-8">
        <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Investment Phase Complete
        </h3>
        <div className="space-y-3">
          <p className="text-[14px] text-text-secondary font-sans font-light leading-relaxed">
            Funding has successfully finished. The operator may now withdraw the capital and begin operating the venue.
          </p>
          <p className="text-[14px] text-text-secondary font-sans font-light leading-relaxed">
            Revenue distributions will become available after deposits are made by the operator.
          </p>
        </div>
      </div>

      {/* ─── CTA Buttons ─── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/venue/${venueAddress}/revenue`}
          className="btn-gold flex items-center justify-center gap-2.5 flex-1 rounded-sm px-6 py-3.5 text-[14px] font-semibold tracking-wide font-sans no-underline"
        >
          View Revenue
        </Link>
        <Link
          href="/venues"
          className="flex-1 flex items-center justify-center gap-2 rounded-sm border border-border bg-background px-5 py-3 text-[13px] font-medium text-text-secondary font-sans tracking-wide hover:border-accent/50 hover:text-text-primary transition-colors duration-200 no-underline"
        >
          Browse Venues
        </Link>
      </div>
    </section>
  );
}
