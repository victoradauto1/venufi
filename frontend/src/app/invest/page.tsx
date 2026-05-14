"use client";

import { useState } from "react";
import Footer from "../components/Footer";

export default function InvestPage() {
  const [ethAmount, setEthAmount] = useState("");

  /* Mock computation */
  const parsed = parseFloat(ethAmount) || 0;
  const sharePercent = parsed > 0 ? ((parsed / 10) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col flex-1">
      {/* ─── Header ─── */}
      <section className="flex flex-col items-center text-center px-6 pt-32 pb-16">
        <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Funding Round
        </span>

        <h1 className="text-5xl sm:text-6xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
          Invest in Venue
        </h1>

        <p className="mt-5 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
          Participate in the funding round and receive proportional revenue
          shares.
        </p>
      </section>

      {/* ─── Main Content ─── */}
      <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
        {/* ─── Venue Information Card ─── */}
        <div className="w-full lg:flex-1 rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-[21px] font-light text-text-primary font-serif tracking-wide">
              Historic Cultural Venue
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-muted px-3.5 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase text-accent font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              ACTIVE
            </span>
          </div>

          <div className="h-px w-full bg-border mb-7" />

          <div className="grid grid-cols-2 gap-7">
            <Stat label="Funding Goal" value="10 ETH" />
            <Stat label="Total Raised" value="10 ETH" />
          </div>

          <div className="mt-7 h-px w-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: "100%" }}
            />
          </div>
          <p className="mt-2.5 text-right text-[13px] text-text-tertiary font-sans tracking-wide">
            100% funded
          </p>

          <div className="mt-7 h-px w-full bg-border" />

          <div className="mt-7">
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Investor Revenue Model
            </p>
            <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
              Revenue distributed proportionally to shares
            </p>
          </div>
        </div>

        {/* ─── Investment Form + Preview ─── */}
        <div className="w-full lg:flex-1 flex flex-col gap-8">
          {/* ─── Form Card ─── */}
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
              Investment
            </h3>

            <label
              htmlFor="eth-amount"
              className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
            >
              Amount (ETH)
            </label>
            <input
              id="eth-amount"
              type="number"
              min="0"
              step="0.01"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              placeholder="Enter ETH amount"
              className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200"
            />
            <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
              Shares are proportional to invested ETH.
            </p>

            <button
              id="invest-btn"
              className="mt-7 w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-pointer font-sans"
            >
              <InvestIcon />
              Invest
            </button>
          </div>

          {/* ─── Transaction Preview ─── */}
          <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
            <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
              Transaction Preview
            </h3>

            <p className="text-[13px] text-text-tertiary mb-4 font-sans tracking-wide uppercase">
              You will receive:
            </p>

            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-light text-text-primary font-serif tracking-tight">
                {parsed > 0 ? parsed.toFixed(1) : "1.0"} ETH
              </span>
              <span className="text-[15px] text-accent font-sans font-medium">
                → {parsed > 0 ? sharePercent : "10.0"}% share
              </span>
            </div>

            <div className="mt-5 h-px w-full bg-border" />

            <p className="mt-4 text-[12px] text-text-tertiary/70 font-sans italic">
              Mock values for frontend showcase.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}

/* ── Inline Components ── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
        {label}
      </p>
      <p className="text-xl font-light text-text-primary font-serif tracking-tight">
        {value}
      </p>
    </div>
  );
}

function InvestIcon() {
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
      <line x1="12" y1="1" x2="12" y2="23" />
      <polyline points="17 18 12 23 7 18" />
      <path d="M21 12H3" />
    </svg>
  );
}
