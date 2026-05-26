"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import {
  useVenueState,
  useVenueFundingGoal,
  useVenueCurrentRaised,
  useVenueOperator,
  useVenueEndTime,
  VenueState,
  VENUE_STATE_LABELS,
  type VenueStateValue,
} from "@/hooks/web3/useVenue";
import { formatEth } from "@/lib/format";
import { Stat } from "../../../components/Stat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a unix timestamp (bigint seconds) into a human-readable remaining
 * duration or date string. Returns "—" if endTime is 0 (not set).
 */
function formatEndTime(endTime: bigint): string {
  const ts = Number(endTime);
  if (ts === 0) return "Not set";

  const now = Math.floor(Date.now() / 1000);
  const diff = ts - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} remaining`;

  const hours = Math.floor(diff / 3600);
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} remaining`;

  const minutes = Math.floor(diff / 60);
  return `${minutes} min remaining`;
}

/**
 * Truncates an address to 0x1234…abcd format.
 */
function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminContentProps {
  venueAddress: string;
}

export function AdminContent({ venueAddress }: AdminContentProps) {
  const address = venueAddress as Address;
  const { address: userAddress } = useAccount();

  // ── On-chain reads ──
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading } = useVenueCurrentRaised(address);
  const { data: operatorRaw, isLoading: operatorLoading } = useVenueOperator(address);
  const { data: endTimeRaw, isLoading: endTimeLoading } = useVenueEndTime(address);

  const isLoading =
    stateLoading || goalLoading || raisedLoading || operatorLoading || endTimeLoading;

  // ── Derived values ──
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";

  const goalEth = fundingGoal != null ? formatEth(fundingGoal as bigint) : "—";
  const raisedEth = currentRaised != null ? formatEth(currentRaised as bigint) : "—";

  const operatorAddress = (operatorRaw as string) ?? "";
  const operatingPeriod =
    endTimeRaw != null ? formatEndTime(endTimeRaw as bigint) : "—";

  // ── Operator gating ──
  const isOperator =
    !!userAddress &&
    !!operatorAddress &&
    userAddress.toLowerCase() === operatorAddress.toLowerCase();

  // ── Form state ──
  const [revenueAmount, setRevenueAmount] = useState("");

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
        {/* Info card skeleton */}
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
          <div className="mt-7">
            <div className="h-4 w-32 rounded bg-border/50 mb-2" />
            <div className="h-6 w-24 rounded bg-border/50" />
          </div>
        </div>

        {/* Controls skeleton */}
        <div className="w-full lg:flex-1 flex flex-col gap-8 animate-pulse">
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-10">
              <div className="h-12 w-full rounded bg-border/50" />
              <div className="h-px w-full bg-border" />
              <div className="h-12 w-full rounded bg-border/50" />
              <div className="h-px w-full bg-border" />
              <div className="h-12 w-full rounded bg-border/50" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Loaded state ──
  return (
    <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
      {/* ─── Venue Info Card ─── */}
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
        <div className="mt-7 h-px w-full bg-border" />
        <div className="mt-7 grid grid-cols-2 gap-7">
          <Stat label="Operating Period" value={operatingPeriod} />
          <div>
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Operator
            </p>
            <p
              className="text-xl font-light text-text-primary font-serif tracking-tight"
              title={operatorAddress}
            >
              {operatorAddress ? truncateAddress(operatorAddress) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Operator Controls ─── */}
      <div className="w-full lg:flex-1 flex flex-col gap-8">
        {/* Operator gating notice */}
        {!isOperator && (
          <div className="rounded-sm border border-border bg-surface-raised/50 p-6 flex items-start gap-3">
            <InfoIcon />
            <p className="text-[13px] text-text-secondary font-sans font-light italic leading-relaxed">
              {userAddress
                ? "Connected wallet is not the venue operator. Admin controls are restricted."
                : "Connect your wallet to access operator controls."}
            </p>
          </div>
        )}

        <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-10">
            {/* Finalize Funding */}
            <div className="flex flex-col">
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 cursor-not-allowed opacity-60 font-sans"
              >
                Finalize Funding
              </button>
              <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                Transitions the venue from FUNDING to ACTIVE once the funding goal is reached.
              </p>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Deposit Revenue */}
            <div className="flex flex-col">
              <label
                htmlFor="revenue-amount"
                className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
              >
                Revenue Amount (ETH)
              </label>
              <input
                id="revenue-amount"
                type="number"
                min="0"
                step="0.01"
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
                placeholder="Enter revenue amount"
                className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 mb-4"
              />
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 cursor-not-allowed opacity-60 font-sans"
              >
                Deposit Revenue
              </button>
              <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                Distributes deposited revenue proportionally to investors.
              </p>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Withdraw Fees */}
            <div className="flex flex-col">
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 cursor-not-allowed opacity-60 font-sans"
              >
                Withdraw Fees
              </button>
              <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                Withdraw accumulated operator fees.
              </p>
            </div>
          </div>
        </div>

        {/* Info notice */}
        <div className="rounded-sm border border-border bg-surface-raised/50 p-6 flex items-start gap-3">
          <InfoIcon />
          <p className="text-[13px] text-text-secondary font-sans font-light italic leading-relaxed">
            Write integration coming soon — buttons are disabled.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-tertiary shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
