"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import {
  useVenueState,
  useVenueTotalRevenue,
  useVenuePending,
  useVenueUserShares,
  useVenueFundingGoal,
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
 * Computes the user's share allocation as a percentage of the funding goal.
 * Returns a string with 1 decimal place, e.g. "30.0".
 */
function computeShareAllocation(
  userShares: bigint | undefined,
  fundingGoal: bigint | undefined,
): string {
  if (userShares == null || fundingGoal == null) return "0.0";
  if (fundingGoal === BigInt(0)) return "0.0";
  const percent = Number((userShares * BigInt(10000)) / fundingGoal) / 100;
  return percent.toFixed(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RevenueContentProps {
  venueAddress: string;
}

export function RevenueContent({ venueAddress }: RevenueContentProps) {
  const address = venueAddress as Address;
  const { address: userAddress } = useAccount();

  // ── On-chain reads ──
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: totalRevenue, isLoading: revenueLoading } = useVenueTotalRevenue(address);
  const { data: pendingRaw, isLoading: pendingLoading } = useVenuePending(address, userAddress);
  const { data: userShares, isLoading: sharesLoading } = useVenueUserShares(address, userAddress);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);

  const isLoading = stateLoading || revenueLoading || goalLoading;
  const isUserLoading = pendingLoading || sharesLoading;

  // ── Derived values ──
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";

  const totalRevenueEth = totalRevenue != null ? formatEth(totalRevenue as bigint) : "—";
  const pendingEth = pendingRaw != null ? formatEth(pendingRaw as bigint) : "0";
  const shareAllocation = computeShareAllocation(
    userShares as bigint | undefined,
    fundingGoal as bigint | undefined,
  );

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
            <div className="h-5 w-48 rounded bg-border/50" />
          </div>
        </div>

        {/* Claim + history skeleton */}
        <div className="w-full lg:flex-1 flex flex-col gap-8 animate-pulse">
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="h-4 w-32 rounded bg-border/50 mb-7" />
            <div className="h-12 w-40 rounded bg-border/50 mb-8" />
            <div className="h-12 w-full rounded bg-border/50" />
          </div>
          <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
            <div className="h-4 w-36 rounded bg-border/50 mb-6" />
            <div className="h-5 w-full rounded bg-border/50" />
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
          {userAddress ? (
            <>
              <Stat
                label="Pending Revenue"
                value={isUserLoading ? "Loading…" : `${pendingEth} ETH`}
              />
              <Stat
                label="Share Allocation"
                value={isUserLoading ? "Loading…" : `${shareAllocation}%`}
              />
            </>
          ) : (
            <>
              <Stat label="Pending Revenue" value="— ETH" />
              <Stat label="Share Allocation" value="—%" />
            </>
          )}
        </div>

        <div className="mt-7 h-px w-full bg-border" />

        <div className="mt-7 grid grid-cols-2 gap-7">
          <Stat label="Total Protocol Revenue" value={`${totalRevenueEth} ETH`} />
          <div>
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Distribution Model
            </p>
            <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
              Proportional to invested shares
            </p>
          </div>
        </div>
      </div>

      {/* ─── Claim + History ─── */}
      <div className="w-full lg:flex-1 flex flex-col gap-8">
        {/* Wallet notice */}
        {!userAddress && (
          <div className="rounded-sm border border-border bg-surface-raised/50 p-6 flex items-start gap-3">
            <InfoIcon />
            <p className="text-[13px] text-text-secondary font-sans font-light italic leading-relaxed">
              Connect your wallet to view your pending revenue and claim earnings.
            </p>
          </div>
        )}

        {/* ─── Claim Card ─── */}
        <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
            Available to Claim
          </h3>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-4xl sm:text-5xl font-light tracking-[-0.02em] text-text-primary font-serif">
              {userAddress ? (isUserLoading ? "…" : pendingEth) : "—"}
            </span>
            <span className="text-lg text-text-secondary font-sans tracking-wide">
              ETH
            </span>
          </div>
          <button
            disabled
            className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 cursor-not-allowed opacity-60 font-sans"
          >
            Claim Revenue
          </button>
          <p className="mt-2 text-[12px] text-text-tertiary/60 font-sans italic text-center">
            Write integration coming soon
          </p>
          <p className="mt-3 text-[13px] text-text-tertiary font-sans font-light text-center">
            Revenue is distributed proportionally according to your ownership share.
          </p>
        </div>

        {/* ─── Revenue History ─── */}
        <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-6 font-sans">
            Recent Deposits
          </h3>
          <div className="flex flex-col items-center py-4">
            <InfoIcon />
            <p className="mt-3 text-[13px] text-text-tertiary font-sans font-light text-center leading-relaxed">
              Historical deposit indexing is not yet implemented.
              <br />
              On-chain event logs will be integrated in a future update.
            </p>
          </div>
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
