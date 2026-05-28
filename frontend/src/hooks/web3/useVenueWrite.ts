"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { venueFiAbi } from "@/lib/contracts/venueFi";

// ===========================================================================
//  Internal helper — eliminates boilerplate across all venue write hooks
// ===========================================================================

/**
 * Creates a standardised write hook for a VenueFi contract function.
 *
 * Every hook returned from this factory exposes the same ergonomic surface:
 *   • an `execute` function (+ optional `writeContractAsync` for advanced use)
 *   • tx hash, receipt, loading / success / error states
 *   • a `reset` to clear state for retry flows
 *
 * @param venueAddress - dynamic address of the VenueFi instance
 * @param functionName - Solidity function name as declared in the ABI
 */
function useVenueWrite(
  venueAddress: Address | undefined,
  functionName: string,
) {
  if (!venueAddress) {
    throw new Error("Venue address required");
  }
  
  const {
    data: txHash,
    writeContractAsync,
    isPending: isWritePending,
    isSuccess: isWriteSuccess,
    isError: isWriteError,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  return {
    writeContractAsync,
    txHash,
    receipt,
    isWritePending,
    isConfirming,
    isConfirmed,
    isWriteSuccess,
    isError: isWriteError || isReceiptError,
    error: writeError || receiptError,
    reset,
    // Internal — shared config used by each concrete hook's `execute` fn
    _config: {
      address: venueAddress,
      abi: venueFiAbi,
      functionName,
    },
  } as const;
}

// ===========================================================================
//  Public hooks — one per VenueFi write function
// ===========================================================================

// ---------------------------------------------------------------------------
// useInvest — invest ETH into a venue during the FUNDING phase
// ---------------------------------------------------------------------------

export function useInvest(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "invest");

  async function invest(value: bigint) {
    return hook.writeContractAsync({
      ...hook._config,
      value,
    });
  }

  const { _config, ...publicState } = hook;
  return { invest, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useRefund — claim a refund after a failed / expired funding round
// ---------------------------------------------------------------------------

export function useRefund(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "refund");

  async function refund() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { refund, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useDepositRevenue — operator deposits revenue (payable)
// ---------------------------------------------------------------------------

export function useDepositRevenue(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "depositRevenue");

  async function depositRevenue(value: bigint) {
    return hook.writeContractAsync({
      ...hook._config,
      value,
    });
  }

  const { _config, ...publicState } = hook;
  return { depositRevenue, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useClaimRevenue — investor claims their accrued revenue share
// ---------------------------------------------------------------------------

export function useClaimRevenue(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "claimRevenue");

  async function claimRevenue() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { claimRevenue, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useWithdrawCapital — operator withdraws the raised capital
// ---------------------------------------------------------------------------

export function useWithdrawCapital(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "withdrawCapital");

  async function withdrawCapital() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { withdrawCapital, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useWithdrawOperatorFees — operator withdraws accrued fee revenue
// ---------------------------------------------------------------------------

export function useWithdrawOperatorFees(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "withdrawOperatorFees");

  async function withdrawOperatorFees() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { withdrawOperatorFees, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useFinalizeFunding — transition venue from FUNDING → ACTIVE
// ---------------------------------------------------------------------------

export function useFinalizeFunding(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "finalizeFunding");

  async function finalizeFunding() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { finalizeFunding, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useFinalizeCampaign — transition venue from ACTIVE → ENDED
// ---------------------------------------------------------------------------

export function useFinalizeCampaign(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "finalizeCampaign");

  async function finalizeCampaign() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { finalizeCampaign, ...publicState } as const;
}

// ---------------------------------------------------------------------------
// useExpireFunding — transition venue to ENDED when deadline passes
//                    without reaching the funding goal
// ---------------------------------------------------------------------------

export function useExpireFunding(venueAddress: Address | undefined) {
  const hook = useVenueWrite(venueAddress, "expireFunding");

  async function expireFunding() {
    return hook.writeContractAsync({ ...hook._config });
  }

  const { _config, ...publicState } = hook;
  return { expireFunding, ...publicState } as const;
}
