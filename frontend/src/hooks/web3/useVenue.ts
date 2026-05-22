"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { venueFiAbi } from "@/lib/contracts/venueFi";

// ---------------------------------------------------------------------------
// Contract state enum (mirrors VenueFi.State in Solidity)
// ---------------------------------------------------------------------------

export const VenueState = {
  FUNDING: 0,
  ACTIVE: 1,
  ENDED: 2,
} as const;

export type VenueStateValue = (typeof VenueState)[keyof typeof VenueState];

export const VENUE_STATE_LABELS: Record<VenueStateValue, string> = {
  [VenueState.FUNDING]: "Funding",
  [VenueState.ACTIVE]: "Active",
  [VenueState.ENDED]: "Ended",
};

// ---------------------------------------------------------------------------
// Shared config builder (avoids repetition across hooks)
// ---------------------------------------------------------------------------

function venueReadConfig<TFunctionName extends string>(
  venueAddress: Address | undefined,
  functionName: TFunctionName,
) {
  return {
    address: venueAddress,
    abi: venueFiAbi,
    functionName,
    query: { enabled: !!venueAddress },
  } as const;
}

// ---------------------------------------------------------------------------
// Hooks — view functions with no arguments
// ---------------------------------------------------------------------------

export function useVenueState(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "state"));
}

export function useVenueCurrentRaised(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "currentRaised"));
}

export function useVenueFundingGoal(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "fundingGoal"));
}

export function useVenueTotalRevenue(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "totalRevenue"));
}

export function useVenueOperator(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "operator"));
}

export function useVenueDeadline(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "deadline"));
}

export function useVenueEndTime(venueAddress: Address | undefined) {
  return useReadContract(venueReadConfig(venueAddress, "endTime"));
}

// ---------------------------------------------------------------------------
// Hooks — view functions with user address argument
// ---------------------------------------------------------------------------

export function useVenuePending(
  venueAddress: Address | undefined,
  user: Address | undefined,
) {
  return useReadContract({
    address: venueAddress,
    abi: venueFiAbi,
    functionName: "pending",
    args: user ? [user] : undefined,
    query: { enabled: !!venueAddress && !!user },
  });
}

export function useVenueUserShares(
  venueAddress: Address | undefined,
  user: Address | undefined,
) {
  return useReadContract({
    address: venueAddress,
    abi: venueFiAbi,
    functionName: "getUserShares",
    args: user ? [user] : undefined,
    query: { enabled: !!venueAddress && !!user },
  });
}
