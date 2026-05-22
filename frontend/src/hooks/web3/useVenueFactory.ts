"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import {
  venueFactoryAbi,
  venueFactoryAddress,
} from "@/lib/contracts/venueFactory";

// ---------------------------------------------------------------------------
// useVenuesCount — total number of venues created via the factory
// ---------------------------------------------------------------------------

export function useVenuesCount() {
  return useReadContract({
    address: venueFactoryAddress,
    abi: venueFactoryAbi,
    functionName: "getVenuesCount",
  });
}

// ---------------------------------------------------------------------------
// useVenueByIndex — get a venue address by its index in the registry
// ---------------------------------------------------------------------------

export function useVenueByIndex(index: bigint) {
  return useReadContract({
    address: venueFactoryAddress,
    abi: venueFactoryAbi,
    functionName: "venues",
    args: [index],
  });
}

// ---------------------------------------------------------------------------
// useVenuesByOperator — get all venue addresses created by an operator
// ---------------------------------------------------------------------------

export function useVenuesByOperator(operator: Address | undefined) {
  return useReadContract({
    address: venueFactoryAddress,
    abi: venueFactoryAbi,
    functionName: "getVenuesByOperator",
    args: operator ? [operator] : undefined,
    query: { enabled: !!operator },
  });
}
