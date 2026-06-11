"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { parseEther, decodeEventLog } from "viem";
import { useAccount } from "wagmi";
import {
  useCreateVenue,
  type CreateVenueParams,
} from "@/hooks/web3/useVenueFactoryWrite";
import { venueFactoryAbi } from "@/lib/contracts/venueFactory";
import { TransactionButton } from "@/components/tx/TransactionButton";
import { TransactionStatus } from "@/components/tx/TransactionStatus";
import { IDLE_TX_STATE, type TransactionState } from "@/types/transaction";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = "https://sepolia.etherscan.io";

/** Seconds per day — used to convert user-facing "days" into on-chain seconds. */
const SECONDS_PER_DAY = 86400n;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface FormFields {
  fundingGoal: string;
  fundingDuration: string;
  operatingDuration: string;
  operatorFeePercentage: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof FormFields, string>>;
}

function validateForm(fields: FormFields): ValidationResult {
  const errors: Partial<Record<keyof FormFields, string>> = {};

  // Funding Goal
  const goal = parseFloat(fields.fundingGoal);
  if (fields.fundingGoal.trim() === "" || !Number.isFinite(goal) || goal <= 0) {
    errors.fundingGoal = "Enter a positive ETH amount.";
  }

  // Funding Duration
  const fd = parseInt(fields.fundingDuration, 10);
  if (fields.fundingDuration.trim() === "" || !Number.isFinite(fd) || fd < 1) {
    errors.fundingDuration = "Enter at least 1 day.";
  }

  // Operating Duration
  const od = parseInt(fields.operatingDuration, 10);
  if (
    fields.operatingDuration.trim() === "" ||
    !Number.isFinite(od) ||
    od < 1
  ) {
    errors.operatingDuration = "Enter at least 1 day.";
  }

  // Operator Fee Percentage (0–100)
  const fee = parseInt(fields.operatorFeePercentage, 10);
  if (
    fields.operatorFeePercentage.trim() === "" ||
    !Number.isFinite(fee) ||
    fee < 0 ||
    fee > 100
  ) {
    errors.operatorFeePercentage = "Enter a value between 0 and 100.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Error humaniser (reused pattern)
// ---------------------------------------------------------------------------

function humanizeError(err: unknown): string {
  if (err == null) return "An unknown error occurred.";

  const message =
    typeof err === "object" && "shortMessage" in err
      ? String((err as { shortMessage: unknown }).shortMessage)
      : err instanceof Error
        ? err.message
        : String(err);

  if (/user rejected|user denied/i.test(message)) {
    return "Transaction rejected — you declined the wallet signature.";
  }
  if (/insufficient funds/i.test(message)) {
    return "Insufficient funds — your wallet balance is too low.";
  }
  if (/InvalidFee/i.test(message)) {
    return "Invalid operator fee — the contract rejected the fee percentage.";
  }
  if (/InvalidFundingGoal/i.test(message)) {
    return "Invalid funding goal — must be greater than zero.";
  }
  if (/InvalidFundingDuration/i.test(message)) {
    return "Invalid funding duration — must be at least 1 day.";
  }
  if (/InvalidOperatingDuration/i.test(message)) {
    return "Invalid operating duration — must be at least 1 day.";
  }
  if (message.length > 160) {
    return message.slice(0, 157) + "…";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Extract venue address from receipt logs
// ---------------------------------------------------------------------------

function extractVenueAddress(
  logs: readonly { address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }[],
): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: venueFactoryAbi,
        eventName: "VenueCreated",
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data,
      });
      if (decoded.args && "venue" in decoded.args) {
        return decoded.args.venue as string;
      }
    } catch {
      // Not this event — skip
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateVenueContent() {
  const { isConnected } = useAccount();

  // ── Write hook ──────────────────────────────────────────────────────────
  const {
    createVenue,
    txHash,
    receipt,
    isConfirming,
    isConfirmed,
    isError,
    error: writeError,
    reset,
  } = useCreateVenue();

  // ── Form state ──────────────────────────────────────────────────────────
  const [fundingGoal, setFundingGoal] = useState("");
  const [fundingDuration, setFundingDuration] = useState("");
  const [operatingDuration, setOperatingDuration] = useState("");
  const [operatorFeePercentage, setOperatorFeePercentage] = useState("");
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({});

  // ── Validation ──────────────────────────────────────────────────────────
  const validation = useMemo(
    () =>
      validateForm({
        fundingGoal,
        fundingDuration,
        operatingDuration,
        operatorFeePercentage,
      }),
    [fundingGoal, fundingDuration, operatingDuration, operatorFeePercentage],
  );

  // ── Transaction UX state ────────────────────────────────────────────────
  const [tx, setTx] = useState<TransactionState>(IDLE_TX_STATE);
  const [createdVenueAddress, setCreatedVenueAddress] = useState<string | null>(null);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setTx({ status: "success", hash: txHash });
      // Extract venue address from receipt
      if (receipt?.logs) {
        const venue = extractVenueAddress(
          receipt.logs as readonly {
            address: string;
            topics: readonly `0x${string}`[];
            data: `0x${string}`;
          }[],
        );
        if (venue) setCreatedVenueAddress(venue);
      }
    } else if (isConfirming && txHash) {
      setTx({ status: "confirming", hash: txHash });
    } else if (isError) {
      setTx({
        status: "error",
        hash: txHash ?? undefined,
        error: humanizeError(writeError),
      });
    }
  }, [isConfirmed, isConfirming, isError, txHash, writeError, receipt]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const isTxInProgress =
    tx.status === "pendingSignature" || tx.status === "confirming";
  const canSubmit =
    isConnected && validation.isValid && !isTxInProgress;

  // ── Handler ─────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;

    // Mark all fields as touched
    setTouched({
      fundingGoal: true,
      fundingDuration: true,
      operatingDuration: true,
      operatorFeePercentage: true,
    });

    if (!validation.isValid) return;

    reset();
    setCreatedVenueAddress(null);
    setTx({ status: "pendingSignature" });

    try {
      const params: CreateVenueParams = {
        fundingGoal: parseEther(fundingGoal),
        fundingDuration: BigInt(parseInt(fundingDuration, 10)) * SECONDS_PER_DAY,
        operatingDuration: BigInt(parseInt(operatingDuration, 10)) * SECONDS_PER_DAY,
        operatorFeePercentage: BigInt(parseInt(operatorFeePercentage, 10)),
      };

      await createVenue(params);
      // wagmi hooks drive the rest via useEffect sync above
    } catch (err: unknown) {
      setTx({
        status: "error",
        error: humanizeError(err),
      });
    }
  }, [
    canSubmit,
    validation.isValid,
    fundingGoal,
    fundingDuration,
    operatingDuration,
    operatorFeePercentage,
    createVenue,
    reset,
  ]);

  // Clear form on success
  useEffect(() => {
    if (tx.status === "success") {
      setFundingGoal("");
      setFundingDuration("");
      setOperatingDuration("");
      setOperatorFeePercentage("");
      setTouched({});
    }
  }, [tx.status]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="flex flex-col items-center px-6 pb-24 max-w-2xl mx-auto w-full">
      {/* ─── Form Card ─── */}
      <div className="w-full rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
          Campaign Parameters
        </h3>

        <div className="flex flex-col gap-6">
          {/* Funding Goal */}
          <div>
            <label
              htmlFor="funding-goal"
              className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
            >
              Funding Goal (ETH)
            </label>
            <input
              id="funding-goal"
              type="number"
              min="0"
              step="0.01"
              value={fundingGoal}
              onChange={(e) => setFundingGoal(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fundingGoal: true }))}
              placeholder="e.g. 10"
              disabled={isTxInProgress}
              className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-60"
            />
            {touched.fundingGoal && validation.errors.fundingGoal && (
              <p className="mt-1.5 text-[12px] text-red-400/90 font-sans">
                {validation.errors.fundingGoal}
              </p>
            )}
          </div>

          {/* Funding Duration */}
          <div>
            <label
              htmlFor="funding-duration"
              className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
            >
              Funding Duration (days)
            </label>
            <input
              id="funding-duration"
              type="number"
              min="1"
              step="1"
              value={fundingDuration}
              onChange={(e) => setFundingDuration(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, fundingDuration: true }))
              }
              placeholder="e.g. 30"
              disabled={isTxInProgress}
              className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-60"
            />
            {touched.fundingDuration && validation.errors.fundingDuration && (
              <p className="mt-1.5 text-[12px] text-red-400/90 font-sans">
                {validation.errors.fundingDuration}
              </p>
            )}
          </div>

          {/* Operating Duration */}
          <div>
            <label
              htmlFor="operating-duration"
              className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
            >
              Operating Duration (days)
            </label>
            <input
              id="operating-duration"
              type="number"
              min="1"
              step="1"
              value={operatingDuration}
              onChange={(e) => setOperatingDuration(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, operatingDuration: true }))
              }
              placeholder="e.g. 365"
              disabled={isTxInProgress}
              className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-60"
            />
            {touched.operatingDuration &&
              validation.errors.operatingDuration && (
                <p className="mt-1.5 text-[12px] text-red-400/90 font-sans">
                  {validation.errors.operatingDuration}
                </p>
              )}
          </div>

          {/* Operator Fee Percentage */}
          <div>
            <label
              htmlFor="operator-fee"
              className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
            >
              Operator Fee (%)
            </label>
            <input
              id="operator-fee"
              type="number"
              min="0"
              max="100"
              step="1"
              value={operatorFeePercentage}
              onChange={(e) => setOperatorFeePercentage(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, operatorFeePercentage: true }))
              }
              placeholder="e.g. 10"
              disabled={isTxInProgress}
              className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-60"
            />
            {touched.operatorFeePercentage &&
              validation.errors.operatorFeePercentage && (
                <p className="mt-1.5 text-[12px] text-red-400/90 font-sans">
                  {validation.errors.operatorFeePercentage}
                </p>
              )}
            <p className="mt-1.5 text-[12px] text-text-tertiary/70 font-sans font-light">
              Percentage of deposited revenue retained by the operator.
            </p>
          </div>
        </div>

        {/* Wallet connection notice */}
        {!isConnected && (
          <p className="mt-6 text-[13px] text-amber-500/80 font-sans font-light">
            Connect your wallet to create a venue.
          </p>
        )}

        {/* Submit button */}
        <div className="mt-7">
          <TransactionButton
            onClick={handleCreate}
            disabled={!canSubmit}
            loading={isTxInProgress}
          >
            <DeployIcon />
            {isTxInProgress ? "Deploying…" : "Deploy Venue"}
          </TransactionButton>
        </div>

        <TransactionStatus state={tx} explorerUrl={EXPLORER_URL} />
      </div>

      {/* ─── Success: Created Venue Address ─── */}
      {createdVenueAddress && tx.status === "success" && (
        <div className="w-full mt-8 rounded-sm border border-green-500/30 bg-green-500/5 p-9">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-green-400 mb-5 font-sans">
            Venue Deployed
          </h3>

          <p className="text-[13px] text-text-tertiary mb-3 font-sans tracking-wide uppercase">
            Venue Address
          </p>
          <p
            className="text-[15px] font-mono text-text-primary break-all leading-relaxed"
            title={createdVenueAddress}
          >
            {createdVenueAddress}
          </p>

          <div className="mt-5 h-px w-full bg-border" />

          <a
            href={`/venue/${createdVenueAddress}`}
            className="mt-5 inline-flex items-center gap-2 text-[13px] text-accent font-sans font-medium tracking-wide hover:underline underline-offset-2 transition-colors duration-200"
          >
            View Venue →
          </a>
        </div>
      )}

      {/* ─── Parameter Preview ─── */}
      {(fundingGoal || fundingDuration || operatingDuration || operatorFeePercentage) && (
        <div className="w-full mt-8 rounded-sm border border-border bg-surface-raised/50 p-9">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
            Parameter Preview
          </h3>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[13px] text-text-tertiary mb-1 font-sans tracking-wide uppercase">
                Funding Goal
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {fundingGoal || "—"} ETH
              </p>
            </div>
            <div>
              <p className="text-[13px] text-text-tertiary mb-1 font-sans tracking-wide uppercase">
                Funding Duration
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {fundingDuration || "—"} days
              </p>
            </div>
            <div>
              <p className="text-[13px] text-text-tertiary mb-1 font-sans tracking-wide uppercase">
                Operating Duration
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {operatingDuration || "—"} days
              </p>
            </div>
            <div>
              <p className="text-[13px] text-text-tertiary mb-1 font-sans tracking-wide uppercase">
                Operator Fee
              </p>
              <p className="text-xl font-light text-text-primary font-serif tracking-tight">
                {operatorFeePercentage || "—"}%
              </p>
            </div>
          </div>

          <div className="mt-5 h-px w-full bg-border" />

          <p className="mt-4 text-[12px] text-text-tertiary/70 font-sans italic">
            These parameters are immutable once the venue is deployed.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function DeployIcon() {
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
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
