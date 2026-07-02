"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReadContracts } from "wagmi";
import type { Abi, Address } from "viem";
import {
  venueFactoryAbi,
  venueFactoryAddress,
} from "@/lib/contracts/venueFactory";
import { venueFiAbi } from "@/lib/contracts/venueFi";
import {
  VenueState,
  VENUE_STATE_LABELS,
  type VenueStateValue,
} from "@/hooks/web3/useVenue";
import { formatEth, computeFundingPercent } from "@/lib/format";
import { getVenueAction } from "@/lib/venueActions";
import { Stat } from "../components/Stat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueData {
  address: Address;
  venueName: string;
  state: VenueStateValue;
  fundingGoal: bigint;
  currentRaised: bigint;
  operator: Address;
}

// ---------------------------------------------------------------------------
// State badge colour mapping
// ---------------------------------------------------------------------------

const STATE_BADGE_STYLES: Record<VenueStateValue, string> = {
  [VenueState.FUNDING]:
    "bg-accent-muted text-accent border border-accent/30",
  [VenueState.ACTIVE]:
    "bg-green-500/10 text-green-500 border border-green-500/30",
  [VenueState.ENDED]:
    "bg-red-400/10 text-red-400 border border-red-400/30",
};

// ---------------------------------------------------------------------------
// Address truncation
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VenuesContent() {
  // ── Phase 1: Get venue count ─────────────────────────────────────────────
  const {
    data: countResult,
    isLoading: countLoading,
  } = useReadContracts({
    contracts: [
      {
        address: venueFactoryAddress,
        abi: venueFactoryAbi as Abi,
        functionName: "getVenuesCount",
      },
    ],
  });

  const venueCount =
    countResult?.[0]?.status === "success"
      ? Number(countResult[0].result as bigint)
      : 0;

  const hasCount =
    !countLoading && countResult?.[0]?.status === "success";

  // ── Phase 2: Get all venue addresses ─────────────────────────────────────
  const addressContracts = useMemo(() => {
    if (!hasCount || venueCount === 0) return [];
    return Array.from({ length: venueCount }, (_, i) => ({
      address: venueFactoryAddress,
      abi: venueFactoryAbi as Abi,
      functionName: "venues" as const,
      args: [BigInt(i)] as const,
    }));
  }, [hasCount, venueCount]);

  const {
    data: addressResults,
    isLoading: addressesLoading,
  } = useReadContracts({
    contracts: addressContracts,
    query: { enabled: addressContracts.length > 0 },
  });

  const venueAddresses = useMemo<Address[]>(() => {
    if (!addressResults) return [];
    return addressResults
      .filter((r) => r.status === "success" && r.result)
      .map((r) => r.result as Address);
  }, [addressResults]);

  // ── Phase 3: Get venue details (state, fundingGoal, currentRaised, operator)
  const detailContracts = useMemo(() => {
    if (venueAddresses.length === 0) return [];
    return venueAddresses.flatMap((addr) => [
      { address: addr, abi: venueFiAbi as Abi, functionName: "venueName" as const },
      { address: addr, abi: venueFiAbi as Abi, functionName: "state" as const },
      { address: addr, abi: venueFiAbi as Abi, functionName: "fundingGoal" as const },
      { address: addr, abi: venueFiAbi as Abi, functionName: "currentRaised" as const },
      { address: addr, abi: venueFiAbi as Abi, functionName: "operator" as const },
    ]);
  }, [venueAddresses]);

  const {
    data: detailResults,
    isLoading: detailsLoading,
  } = useReadContracts({
    contracts: detailContracts,
    query: { enabled: detailContracts.length > 0 },
  });

  // ── Assemble venue data ──────────────────────────────────────────────────
const venues = useMemo<VenueData[]>(() => {
  if (!detailResults || venueAddresses.length === 0) return [];

  const result: VenueData[] = [];
  for (let i = 0; i < venueAddresses.length; i++) {
    const base = i * 5;
    const nameRes = detailResults[base];
    const stateRes = detailResults[base + 1];
    const goalRes = detailResults[base + 2];
    const raisedRes = detailResults[base + 3];
    const operatorRes = detailResults[base + 4];

    // Skip venues where any call failed
    if (
      nameRes?.status !== "success" ||
      stateRes?.status !== "success" ||
      goalRes?.status !== "success" ||
      raisedRes?.status !== "success" ||
      operatorRes?.status !== "success"
    ) {
      continue;
    }

    const rawName = nameRes.result;

    const venueName =
      typeof rawName === "string" && rawName.trim().length > 0
        ? rawName.trim()
        : truncateAddress(venueAddresses[i]);

    result.push({
      address: venueAddresses[i],
      venueName,
      state: (stateRes.result as number) as VenueStateValue,
      fundingGoal: goalRes.result as bigint,
      currentRaised: raisedRes.result as bigint,
      operator: operatorRes.result as Address,
    });
  }

  return result;
}, [detailResults, venueAddresses]);

  // ── Loading state ────────────────────────────────────────────────────────
  const isLoading = countLoading || addressesLoading || detailsLoading;

  if (isLoading) {
    return (
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (venues.length === 0) {
    return (
      <section className="flex flex-col items-center px-6 pb-24">
        <div className="rounded-sm border border-border bg-surface p-12 text-center max-w-md">
          <p className="text-[17px] text-text-secondary font-sans font-light leading-[1.8]">
            No venues have been deployed yet.
          </p>
          <Link
            href="/venue/create"
            className="mt-6 inline-flex items-center gap-2.5 rounded-sm bg-btn-bg px-8 py-3.5 text-[15px] font-normal text-btn-text tracking-wide transition-colors duration-200 hover:bg-btn-hover font-sans"
          >
            Create First Venue
          </Link>
        </div>
      </section>
    );
  }

  // ── Loaded state ─────────────────────────────────────────────────────────
  return (
    <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {venues.map((venue) => (
          <VenueCard key={venue.address} venue={venue} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------

function VenueCard({ venue }: { venue: VenueData }) {
  const stateLabel =
    VENUE_STATE_LABELS[venue.state]?.toUpperCase() ?? "UNKNOWN";
  const badgeStyle =
    STATE_BADGE_STYLES[venue.state] ?? STATE_BADGE_STYLES[VenueState.FUNDING];

  const goalEth = formatEth(venue.fundingGoal);
  const raisedEth = formatEth(venue.currentRaised);
  const fundingPercent = computeFundingPercent(
    venue.currentRaised,
    venue.fundingGoal,
  );

  // ── State-aware CTA ────────────────────────────────────────────────────
  const action = getVenueAction(venue.state, venue.address);

  // Button style driven by action variant
  const ctaClassName =
    action.variant === "primary"
      ? "w-full inline-flex items-center justify-center gap-2 rounded-sm bg-btn-bg px-6 py-3 text-[13px] font-medium text-btn-text tracking-wide transition-colors duration-200 hover:bg-btn-hover font-sans"
      : action.variant === "secondary"
        ? "w-full inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-background px-6 py-3 text-[13px] font-medium text-text-secondary tracking-wide transition-colors duration-200 hover:border-accent/50 hover:text-text-primary font-sans"
        : "w-full inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-surface px-6 py-3 text-[13px] font-medium text-text-tertiary tracking-wide transition-colors duration-200 hover:text-text-secondary font-sans";

  return (
    <div className="rounded-sm border border-border bg-surface p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      {/* Header: name + badge */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p
            className="text-[17px] font-light text-text-primary font-serif tracking-wide"
            title={venue.venueName}
          >
            {venue.venueName}
          </p>
          <p
            className="text-[13px] font-mono text-text-tertiary mt-1"
            title={venue.address}
          >
            {truncateAddress(venue.address)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase font-sans ${badgeStyle}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {stateLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <Stat label="Funding Goal" value={`${goalEth} ETH`} />
        <Stat label="Raised" value={`${raisedEth} ETH`} />
      </div>

      {/* Funding progress bar */}
      <div className="mb-2">
        <p className="text-[13px] text-text-tertiary font-sans tracking-wide mb-2">
          Raised: {raisedEth} ETH / {goalEth} ETH
        </p>
        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${fundingPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-[12px] text-text-tertiary font-sans">
          {fundingPercent}%
        </p>
      </div>

      {/* Operator */}
      <div className="mb-6">
        <p className="text-[13px] text-text-tertiary font-sans tracking-wide uppercase mb-1">
          Operator
        </p>
        <p
          className="text-[15px] font-mono text-text-primary"
          title={venue.operator}
        >
          {truncateAddress(venue.operator)}
        </p>
      </div>

      {/* Action — state-aware CTA */}
      <div className="mt-auto">
        <Link
          href={action.href}
          className={ctaClassName}
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-sm border border-border bg-surface p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-4 w-14 rounded bg-border/50 mb-2" />
          <div className="h-5 w-28 rounded bg-border/50" />
        </div>
        <div className="h-7 w-20 rounded bg-border/50" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="h-4 w-24 rounded bg-border/50 mb-2" />
          <div className="h-6 w-16 rounded bg-border/50" />
        </div>
        <div>
          <div className="h-4 w-16 rounded bg-border/50 mb-2" />
          <div className="h-6 w-16 rounded bg-border/50" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-4 w-36 rounded bg-border/50 mb-2" />
        <div className="h-2 w-full rounded-full bg-border/50" />
        <div className="mt-1.5 h-3 w-8 rounded bg-border/50 ml-auto" />
      </div>

      {/* Operator */}
      <div className="mb-6">
        <div className="h-4 w-16 rounded bg-border/50 mb-2" />
        <div className="h-5 w-28 rounded bg-border/50" />
      </div>

      {/* Button */}
      <div className="mt-auto">
        <div className="h-10 w-full rounded bg-border/50" />
      </div>
    </div>
  );
}
