"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  venueFactoryAbi,
  venueFactoryAddress,
} from "@/lib/contracts/venueFactory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateVenueParams {
  fundingDuration: bigint;
  operatingDuration: bigint;
  fundingGoal: bigint;
  operatorFeePercentage: bigint;
}

// ---------------------------------------------------------------------------
// useCreateVenue — deploy a new VenueFi instance via the factory
// ---------------------------------------------------------------------------

export function useCreateVenue() {
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

  // -- Action ---------------------------------------------------------------

  async function createVenue(params: CreateVenueParams) {
    return writeContractAsync({
      address: venueFactoryAddress,
      abi: venueFactoryAbi,
      functionName: "createVenue",
      args: [
        params.fundingDuration,
        params.operatingDuration,
        params.fundingGoal,
        params.operatorFeePercentage,
      ],
    });
  }

  // -- Derived state --------------------------------------------------------

  return {
    /** Trigger the on-chain transaction. */
    createVenue,
    /** Raw writeContractAsync for advanced usage. */
    writeContractAsync,
    /** Transaction hash (available after wallet approval). */
    txHash,
    /** Transaction receipt (available after on-chain confirmation). */
    receipt,
    /** True while the wallet confirmation dialog is open. */
    isWritePending,
    /** True while waiting for on-chain confirmation. */
    isConfirming,
    /** True after the tx has been mined and confirmed. */
    isConfirmed,
    /** True after the wallet signed successfully (before mining). */
    isWriteSuccess,
    /** True if the wallet rejected or the tx reverted on-chain. */
    isError: isWriteError || isReceiptError,
    /** The underlying error object (write or receipt). */
    error: writeError || receiptError,
    /** Reset all internal state (useful for retry flows). */
    reset,
  } as const;
}
