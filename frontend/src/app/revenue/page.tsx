"use client";

import Footer from "../components/Footer";

export default function RevenuePage() {
  return (
    <div className="flex flex-col min-h-screen flex-1 bg-background">
      {/* ─── Header Section ─── */}
      <section className="flex flex-col items-center text-center px-6 pt-32 pb-16">
        <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Returns
        </span>

        <h1 className="text-5xl sm:text-6xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
          Revenue Claims
        </h1>

        <p className="mt-5 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
          Track and claim your accumulated revenue distributions.
        </p>
      </section>

      {/* ─── Main Content ─── */}
      <section className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-14 px-6 pb-24 max-w-5xl mx-auto w-full">
        
        {/* ─── Revenue Overview Card ─── */}
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
            <Stat label="Pending Revenue" value="1.35 ETH" />
            <Stat label="Share Allocation" value="30%" />
          </div>

          <div className="mt-7 h-px w-full bg-border" />

          <div className="mt-7">
            <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
              Distribution Model
            </p>
            <p className="text-[15px] text-text-secondary font-sans font-light leading-relaxed">
              Proportional to invested shares
            </p>
          </div>
        </div>

        {/* ─── Claim Section & History ─── */}
        <div className="w-full lg:flex-1 flex flex-col gap-8">
          
          {/* ─── Claim Card ─── */}
          <div className="rounded-sm border border-border bg-surface p-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-7 font-sans">
              Available to Claim
            </h3>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-4xl sm:text-5xl font-light tracking-[-0.02em] text-text-primary font-serif">
                1.35
              </span>
              <span className="text-lg text-text-secondary font-sans tracking-wide">
                ETH
              </span>
            </div>

            <button
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#1E1E1B] px-8 py-3.5 text-[15px] font-normal text-[#F6F1E8] tracking-wide transition-colors duration-200 hover:bg-[#3A3A35] cursor-pointer font-sans"
            >
              Claim Revenue
            </button>
            <p className="mt-4 text-[13px] text-text-tertiary font-sans font-light text-center">
              Revenue is distributed proportionally according to your ownership share.
            </p>
          </div>

          {/* ─── Revenue History Preview ─── */}
          <div className="rounded-sm border border-border bg-surface-raised/50 p-9">
            <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-6 font-sans">
              Recent Deposits
            </h3>

            <ul className="flex flex-col gap-4">
              <HistoryItem label="Deposit #2" amount="+0.55 ETH" />
              <li className="h-px w-full bg-border" />
              <HistoryItem label="Deposit #1" amount="+0.80 ETH" />
            </ul>
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

function HistoryItem({ label, amount }: { label: string; amount: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-[15px] text-text-secondary font-sans font-light">
        {label}
      </span>
      <span className="text-[15px] text-text-primary font-sans font-medium tracking-wide">
        {amount}
      </span>
    </li>
  );
}
