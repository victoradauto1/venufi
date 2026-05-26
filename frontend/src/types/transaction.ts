// ---------------------------------------------------------------------------
// Shared transaction lifecycle types used by all write actions.
// ---------------------------------------------------------------------------

/**
 * Possible stages of a blockchain write transaction.
 *
 *  idle             → no transaction in progress
 *  pendingSignature → waiting for user to sign in wallet
 *  confirming       → tx submitted, waiting for on-chain confirmation
 *  success          → tx confirmed successfully
 *  error            → tx failed at any stage (rejected, reverted, etc.)
 */
export type TransactionStatus =
  | "idle"
  | "pendingSignature"
  | "confirming"
  | "success"
  | "error";

/**
 * Complete transaction state object.
 *
 * - `status`  — current lifecycle stage
 * - `hash`    — transaction hash (available once submitted)
 * - `error`   — human-readable error message (available on failure)
 */
export interface TransactionState {
  status: TransactionStatus;
  hash?: string;
  error?: string;
}

/**
 * Initial (idle) transaction state — convenient default for useState.
 */
export const IDLE_TX_STATE: TransactionState = {
  status: "idle",
} as const;
