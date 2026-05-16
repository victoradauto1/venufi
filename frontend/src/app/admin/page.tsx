"use client";

import { useState } from "react";
import Footer from "../components/Footer";

export default function AdminPage() {
  const [revenueAmount, setRevenueAmount] = useState("");

  return (
    <div className="flex flex-col min-h-screen flex-1 bg-background">
      {/* ─── Header Section ─── */}
      <section className="flex flex-col items-center text-center px-6 pt-32 pb-16">
        <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Administration
        </span>

        <h1 className="text-5xl sm:text-6xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
          Operator Controls
        </h1>

        <p className="mt-5 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
          Manage venue lifecycle operations and revenue distribution.
        </p>
      </section>

      {/* ─── Main Content ─── */}
      <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
        
        {/* ─── Venue Status Card ─── */}
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

          <div className="mt-7 h-px w-full bg-border" />

          <div className="mt-7 grid grid-cols-1 gap-7">
            <Stat label="Operating Period" value="180 days" />
          </div>
        </div>

        {/* ─── Operator Actions Section ─── */}
        <div className="w-full lg:flex-1 flex flex-col gap-8">
          
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-10">
              
              {/* Action: Finalize Funding */}
              <div className="flex flex-col">
                <button
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-pointer font-sans"
                >
                  Finalize Funding
                </button>
                <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                  Transitions the venue from FUNDING to ACTIVE once the funding goal is reached.
                </p>
              </div>

              <div className="h-px w-full bg-border" />

              {/* Action: Deposit Revenue */}
              <div className="flex flex-col">
                <label
                  htmlFor="revenue-amount"
                  className="block text-[13px] text-text-tertiary mb-2.5 font-sans tracking-wide uppercase"
                >
                  Revenue Amount (ETH)
                </label>
                <input
                  id="revenue-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueAmount}
                  onChange={(e) => setRevenueAmount(e.target.value)}
                  placeholder="Enter revenue amount"
                  className="w-full rounded-sm border border-border bg-background px-5 py-3.5 text-[15px] text-text-primary font-sans placeholder:text-text-tertiary/60 focus:outline-none focus:border-accent transition-colors duration-200 mb-4"
                />
                <button
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-pointer font-sans"
                >
                  Deposit Revenue
                </button>
                <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                  Distributes deposited revenue proportionally to investors.
                </p>
              </div>

              <div className="h-px w-full bg-border" />

              {/* Action: Withdraw Fees */}
              <div className="flex flex-col">
                <button
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-pointer font-sans"
                >
                  Withdraw Fees
                </button>
                <p className="mt-2.5 text-[13px] text-text-tertiary font-sans font-light">
                  Withdraw accumulated operator fees.
                </p>
              </div>
            </div>
          </div>
          
          {/* ─── Mock Status Notice ─── */}
          <div className="rounded-sm border border-border bg-surface-raised/50 p-6 flex items-start gap-3">
            <InfoIcon />
            <p className="text-[13px] text-text-secondary font-sans font-light italic leading-relaxed">
              Frontend showcase mode — blockchain interactions are not connected yet.
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

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-tertiary shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
