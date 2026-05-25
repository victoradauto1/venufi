import { formatEther } from "viem";

/**
 * Formats a bigint wei value to a human-readable ETH string.
 * Trims trailing zeros for cleanliness (e.g. "10" instead of "10.000000000000000000").
 */
export function formatEth(wei: bigint): string {
  const raw = formatEther(wei);
  // Remove unnecessary trailing zeros after decimal point
  if (raw.includes(".")) {
    const trimmed = raw.replace(/\.?0+$/, "");
    return trimmed || "0";
  }
  return raw;
}

/**
 * Computes funding percentage as an integer (0–100).
 * Uses bigint arithmetic to avoid floating-point precision issues,
 * then converts to Number only for the final percentage.
 */
export function computeFundingPercent(raised: bigint, goal: bigint): number {
  if (goal === BigInt(0)) return 0;
  // Multiply first to preserve precision, then divide
  const percent = Number((raised * BigInt(100)) / goal);
  return Math.min(percent, 100);
}
