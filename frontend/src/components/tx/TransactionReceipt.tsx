"use client";

import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = "https://sepolia.etherscan.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single key-value row in the receipt grid. */
export interface ReceiptRow {
  /** Label text (uppercase caption). */
  label: string;
  /** Display value — can be a plain string or a React node for custom rendering. */
  value: React.ReactNode;
  /** If true, the row spans both columns. Default: false. */
  fullWidth?: boolean;
  /** If true, render value in monospace (e.g. addresses). Default: false. */
  mono?: boolean;
  /** If true, render value with accent highlight (e.g. primary amount). Default: false. */
  highlight?: boolean;
}

/** A single action button displayed at the bottom of the receipt. */
export interface ReceiptAction {
  /** Button label text. */
  label: string;
  /** Navigation href — if provided, renders a Link. */
  href?: string;
  /** Click handler — used for non-navigation actions like "Create Another". */
  onClick?: () => void;
  /** If true, renders as the primary gold CTA. Default: false. */
  primary?: boolean;
}

/** Props for the reusable TransactionReceipt component. */
export interface TransactionReceiptProps {
  /** Large heading text, e.g. "Venue Successfully Deployed". */
  title: string;
  /** Subtitle text below the heading. */
  subtitle: string;
  /** Section heading above the receipt grid, e.g. "Deployment Receipt". */
  receiptHeading: string;
  /** The data rows to display in the receipt grid. */
  rows: ReceiptRow[];
  /** Transaction hash — renders an Etherscan link. */
  txHash?: string;
  /** Optional "What's Next?" content — rendered as a list of paragraphs. */
  whatsNext?: string[];
  /** Action buttons shown at the bottom. */
  actions: ReceiptAction[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionReceipt({
  title,
  subtitle,
  receiptHeading,
  rows,
  txHash,
  whatsNext,
  actions,
}: TransactionReceiptProps) {
  const primaryAction = actions.find((a) => a.primary);
  const secondaryActions = actions.filter((a) => !a.primary);

  return (
    <section
      className="flex flex-col items-center px-6 pb-24 max-w-2xl mx-auto w-full"
      role="status"
      aria-label="Transaction confirmed"
    >
      <div className="w-full animate-receipt-enter">
        <div className="w-full rounded-sm border border-border bg-surface p-10 sm:p-12 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          {/* ─── Success Header ─── */}
          <div className="flex flex-col items-center text-center mb-10">
            <SuccessCheckmark />
            <h2 className="mt-6 text-3xl sm:text-[2.5rem] font-light tracking-[-0.02em] text-text-primary font-serif leading-[1.1]">
              {title}
            </h2>
            <p className="mt-3.5 text-[15px] text-text-secondary font-sans font-light leading-relaxed max-w-md">
              {subtitle}
            </p>
          </div>

          <div className="h-px w-full bg-border mb-9" />

          {/* ─── Receipt Grid ─── */}
          <h3 className="text-[12px] font-medium tracking-[0.3em] uppercase text-text-tertiary mb-7 font-sans">
            {receiptHeading}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {rows.map((row, i) => {
              const delayClass =
                i < 8 ? `animate-row-delay-${i}` : "animate-row-delay-7";

              return (
                <div
                  key={i}
                  className={`animate-row-enter ${delayClass} ${
                    row.fullWidth ? "sm:col-span-2" : ""
                  }`}
                >
                  <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                    {row.label}
                  </p>
                  {row.mono ? (
                    <p
                      className="text-[14px] font-mono text-text-primary break-all leading-relaxed"
                      title={
                        typeof row.value === "string" ? row.value : undefined
                      }
                    >
                      {row.value}
                    </p>
                  ) : (
                    <p
                      className={`text-xl font-light font-serif tracking-tight ${
                        row.highlight
                          ? "receipt-highlight"
                          : "text-text-primary"
                      }`}
                    >
                      {row.value}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Transaction Hash ─── */}
          {txHash && (
            <>
              <div className="mt-7 h-px w-full bg-border" />
              <div className="mt-5">
                <p className="text-[11px] text-text-tertiary mb-1.5 font-sans tracking-[0.15em] uppercase">
                  Transaction
                </p>
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-mono text-accent hover:text-accent-hover transition-colors duration-200 underline underline-offset-2"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-8)}
                  <ExternalLinkIcon />
                </a>
              </div>
            </>
          )}

          {/* ─── What's Next ─── */}
          {whatsNext && whatsNext.length > 0 && (
            <>
              <div className="mt-9 h-px w-full bg-border" />
              <div className="mt-7">
                <h3 className="text-[12px] font-medium tracking-[0.3em] uppercase text-text-tertiary mb-5 font-sans">
                  What&apos;s Next
                </h3>
                <div className="space-y-3">
                  {whatsNext.map((text, i) => (
                    <p
                      key={i}
                      className="text-[14px] text-text-secondary font-sans font-light leading-relaxed pl-4 border-l-2 border-border"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-9 h-px w-full bg-border" />

          {/* ─── Actions ─── */}
          <div className="mt-9 flex flex-col gap-3">
            {/* Primary CTA */}
            {primaryAction && <ActionButton action={primaryAction} />}

            {/* Secondary actions */}
            {secondaryActions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                {secondaryActions.map((action, i) => (
                  <ActionButton key={i} action={action} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({ action }: { action: ReceiptAction }) {
  const primaryClasses =
    "btn-gold flex items-center justify-center gap-2.5 w-full rounded-sm px-6 py-3.5 text-[14px] font-semibold tracking-wide font-sans no-underline";
  const secondaryClasses =
    "flex-1 flex items-center justify-center gap-2 rounded-sm border border-border bg-background px-5 py-3 text-[13px] font-medium text-text-secondary font-sans tracking-wide hover:border-accent/50 hover:text-text-primary transition-colors duration-200 no-underline";

  const classes = action.primary ? primaryClasses : secondaryClasses;

  if (action.href) {
    return (
      <Link href={action.href} className={classes}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={`${classes} cursor-pointer`}
    >
      {action.label}
    </button>
  );
}

function SuccessCheckmark() {
  return (
    <div className="animate-check-icon animate-check-ring w-16 h-16 rounded-full border-2 border-accent/40 bg-accent-muted flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" className="animate-check-stroke" />
      </svg>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-60"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
