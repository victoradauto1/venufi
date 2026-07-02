"use client";

import Link from "next/link";
import type { Address } from "viem";
import {
  useVenueName,
  useVenueState,
  useVenueFundingGoal,
  useVenueCurrentRaised,
  VenueState,
  VENUE_STATE_LABELS,
  type VenueStateValue,
} from "@/hooks/web3/useVenue";
import { formatEth, computeFundingPercent } from "@/lib/format";
import { getVenueAction } from "@/lib/venueActions";
import { Stat } from "../../components/Stat";

// ---------------------------------------------------------------------------
// Lifecycle visual
// ---------------------------------------------------------------------------

const LIFECYCLE_STEPS = ["FUNDING", "ACTIVE", "ENDED"] as const;

const STATE_TO_STEP: Record<VenueStateValue, (typeof LIFECYCLE_STEPS)[number]> = {
  [VenueState.FUNDING]: "FUNDING",
  [VenueState.ACTIVE]: "ACTIVE",
  [VenueState.ENDED]: "ENDED",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VenueOverviewProps {
  venueAddress: string;
}

export function VenueOverview({ venueAddress }: VenueOverviewProps) {
  const address = venueAddress as Address;

  const { data: nameRaw, isLoading: nameLoading } = useVenueName(address);
  const { data: stateRaw, isLoading: stateLoading } = useVenueState(address);
  const { data: fundingGoal, isLoading: goalLoading } = useVenueFundingGoal(address);
  const { data: currentRaised, isLoading: raisedLoading } = useVenueCurrentRaised(address);

  const isLoading = nameLoading || stateLoading || goalLoading || raisedLoading;

  const venueName = (nameRaw as string) || "VenueFi Campaign";

  // Derived values (safe defaults while loading)
  const venueState = (stateRaw ?? VenueState.FUNDING) as VenueStateValue;
  const stateLabel = VENUE_STATE_LABELS[venueState]?.toUpperCase() ?? "UNKNOWN";
  const currentStep = STATE_TO_STEP[venueState] ?? "FUNDING";

  const goalEth = fundingGoal != null ? formatEth(fundingGoal as bigint) : "—";
  const raisedEth = currentRaised != null ? formatEth(currentRaised as bigint) : "—";

  const fundingPercent =
    fundingGoal != null && currentRaised != null
      ? computeFundingPercent(currentRaised as bigint, fundingGoal as bigint)
      : 0;

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <>
        {/* Overview card skeleton */}
        <div className="w-full max-w-md lg:max-w-sm xl:max-w-md rounded-sm border border-border bg-surface p-10 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col justify-center animate-pulse">
          <div className="flex items-center justify-between mb-8">
            <div className="h-6 w-40 rounded bg-border/50" />
            <div className="h-7 w-20 rounded bg-border/50" />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="h-4 w-24 rounded bg-border/50 mb-2" />
              <div className="h-6 w-16 rounded bg-border/50" />
            </div>
            <div>
              <div className="h-4 w-24 rounded bg-border/50 mb-2" />
              <div className="h-6 w-16 rounded bg-border/50" />
            </div>
          </div>
          <div className="mt-8 h-px w-full bg-border" />
          <div className="mt-3 h-4 w-20 rounded bg-border/50 ml-auto" />
        </div>

        {/* Lifecycle skeleton */}
        <section className="flex flex-col items-center px-6 pb-24">
          <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-10 font-sans">
            Protocol Lifecycle
          </h3>
          <div className="flex items-center gap-3 sm:gap-4 animate-pulse">
            {LIFECYCLE_STEPS.map((step) => (
              <div key={step} className="flex items-center gap-3 sm:gap-4">
                <span className="inline-flex items-center rounded-sm px-6 py-3 text-[13px] font-medium tracking-[0.2em] uppercase font-sans bg-surface border border-border text-text-tertiary">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  // ── Loaded state ──
  return (
    <>
      {/* ─── Venue Overview Card ─── */}
      <div className="w-full max-w-md lg:max-w-sm xl:max-w-md rounded-sm border border-border bg-surface p-10 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col justify-center">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[21px] font-light text-text-primary font-serif tracking-wide">
            {venueName}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-muted px-3.5 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase text-accent font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {stateLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <Stat label="Funding Goal" value={`${goalEth} ETH`} />
          <Stat label="Total Raised" value={`${raisedEth} ETH`} />
        </div>

        <div className="mt-8 h-px w-full bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${fundingPercent}%` }}
          />
        </div>
        <p className="mt-3 text-right text-[13px] text-text-tertiary font-sans tracking-wide">
          {fundingPercent}% funded
        </p>

        {/* ─── State-aware CTA ─── */}
        {(() => {
          const action = getVenueAction(venueState, venueAddress);

          if (venueState === VenueState.FUNDING) {
            return (
              <>
                <div className="mt-6 h-px w-full bg-border" />
                <Link
                  href={action.href}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-btn-bg px-8 py-3.5 text-[15px] font-medium text-btn-text tracking-wide transition-colors duration-200 hover:bg-btn-hover font-sans"
                >
                  Invest Now
                </Link>
              </>
            );
          }

          if (venueState === VenueState.ACTIVE) {
            return (
              <>
                <div className="mt-6 h-px w-full bg-border" />
                <Link
                  href={action.href}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-sm border border-border bg-background px-8 py-3.5 text-[15px] font-medium text-text-secondary tracking-wide transition-colors duration-200 hover:border-accent/50 hover:text-text-primary font-sans"
                >
                  Revenue Dashboard
                </Link>
              </>
            );
          }

          // ENDED — no button, subtle informational message
          return (
            <>
              <div className="mt-6 h-px w-full bg-border" />
              <p className="mt-4 text-center text-[13px] text-text-tertiary/70 font-sans font-light italic">
                This funding campaign has ended.
              </p>
            </>
          );
        })()}
      </div>

      {/* ─── Lifecycle ─── */}
      <section className="flex flex-col items-center px-6 pb-24">
        <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-10 font-sans">
          Protocol Lifecycle
        </h3>

        <div className="flex items-center gap-3 sm:gap-4">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3 sm:gap-4">
              <span
                className={`
                  inline-flex items-center rounded-sm px-6 py-3 text-[13px] font-medium tracking-[0.2em] uppercase font-sans
                  ${
                    step === currentStep
                      ? "bg-accent-muted text-accent border border-accent/30"
                      : "bg-surface border border-border text-text-tertiary"
                  }
                `}
              >
                {step}
              </span>

              {i < LIFECYCLE_STEPS.length - 1 && (
                <ChevronRight
                  active={LIFECYCLE_STEPS.indexOf(currentStep) > i}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function ChevronRight({ active }: { active: boolean }) {
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
      className={active ? "text-accent" : "text-text-tertiary/30"}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
