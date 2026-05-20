import Footer from "./components/Footer";
import { ConnectButton } from "./components/ConnectButton";

export default function Home() {
  const lifecycleSteps = ["FUNDING", "ACTIVE", "ENDED"] as const;
  const currentStep = "ACTIVE";

  return (
    <div className="flex flex-col flex-1">
      {/* ─── Hero + Venue Overview (side by side) ─── */}
      <section className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-12 lg:gap-16 px-6 pt-32 pb-20 max-w-6xl mx-auto w-full">
        {/* ─── Hero ─── */}
        <div className="flex flex-col items-center justify-center text-center flex-1">
          <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-6 font-sans">
            Revenue-Sharing Infrastructure
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
            VenueFi
          </h1>

          <p className="mt-6 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
            Real World Asset revenue-sharing infrastructure for real-world venues.
          </p>

          <div className="mt-10">
            <ConnectButton />
          </div>
        </div>

        {/* ─── Venue Overview ─── */}
        <div className="w-full max-w-md lg:max-w-sm xl:max-w-md rounded-sm border border-border bg-surface p-10 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col justify-center">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[21px] font-light text-text-primary font-serif tracking-wide">
              Historic Cultural Venue
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-muted px-3.5 py-1.5 text-[12px] font-medium tracking-[0.15em] uppercase text-accent font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <Stat label="Funding Goal" value="10 ETH" />
            <Stat label="Total Raised" value="10 ETH" />
          </div>

          <div className="mt-8 h-px w-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: "100%" }}
            />
          </div>
          <p className="mt-3 text-right text-[13px] text-text-tertiary font-sans tracking-wide">
            100% funded
          </p>
        </div>
      </section>

      {/* ─── Lifecycle ─── */}
      <section className="flex flex-col items-center px-6 pb-24">
        <h3 className="text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-10 font-sans">
          Protocol Lifecycle
        </h3>

        <div className="flex items-center gap-3 sm:gap-4">
          {lifecycleSteps.map((step, i) => (
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

              {i < lifecycleSteps.length - 1 && (
                <ChevronRight
                  active={lifecycleSteps.indexOf(currentStep) > i}
                />
              )}
            </div>
          ))}
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
      <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">{label}</p>
      <p className="text-xl font-light text-text-primary font-serif tracking-tight">
        {value}
      </p>
    </div>
  );
}



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
