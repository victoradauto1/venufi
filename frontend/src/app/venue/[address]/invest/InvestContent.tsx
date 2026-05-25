"use client";

import { useState } from "react";
import type { Address } from "viem";
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
import { formatEth, computeFundingPercent } from "@/lib/format";
import { Stat } from "../../../components/Stat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the share percentage the user would receive for a given ETH input.
 * share% = (inputWei / (currentRaised + inputWei)) * 100
 * Returns a string with 1 decimal place.
 */
function computeSharePreview(
  inputEth: number,
  currentRaised: bigint | undefined,
  fundingGoal: bigint | undefined,
): string {
  if (inputEth <= 0 || fundingGoal == null || currentRaised == null) return "0.0";

  // Convert input to wei-scale bigint (multiply by 1e18)
  // We use Number math here since the user input is already a float
  const goalNum = Number(fundingGoal);
  if (goalNum === 0) return "0.0";

  const inputWei = inputEth * 1e18;
  const raisedNum = Number(currentRaised);
  const totalAfter = raisedNum + inputWei;

  if (totalAfter === 0) return "0.0";
  return ((inputWei / totalAfter) * 100).toFixed(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InvestContentProps {
  venueAddress: string;
}

export function InvestContent({ venueAddress }: InvestContentProps) {
  const address = venueAddress as Address;
  const { address: userAddress } = useAccount();

  // ── On-chain reads ──
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading } = useVenueCurrentRaised(address);
  const { data: userShares } = useVenueUserShares(address, userAddress);

  const isLoading = stateLoading || goalLoading || raisedLoading;

  // ── Derived values ──
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";

  const goalEth = fundingGoal != null ? formatEth(fundingGoal as bigint) : "—";
  const raisedEth = currentRaised != null ? formatEth(currentRaised as bigint) : "—";
  const userSharesEth = userShares != null ? formatEth(userShares as bigint) : "0";

  const fundingPercent =
    fundingGoal != null && currentRaised != null
      ? computeFundingPercent(currentRaised as bigint, fundingGoal as bigint)
      : 0;

  // ── Investment form state ──
  const [ethAmount, setEthAmount] = useState("");
  const parsed = parseFloat(ethAmount) || 0;
  const sharePercent = computeSharePreview(
    parsed,
    currentRaised as bigint | undefined,
    fundingGoal as bigint | undefined,
  );

  // ── Loading skeleton ──
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

  // ── Loaded state ──
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
            className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200"
          />
          <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
            Shares are proportional to invested ETH.
          </p>

          <button
            id="invest-btn"
            disabled
            className="mt-7 w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-not-allowed opacity-60 font-sans"
          >
            <InvestIcon />
            Invest
          </button>
          <p className="mt-2 text-[12px] text-text-tertiary/60 font-sans italic text-center">
            Write integration coming soon
          </p>
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
