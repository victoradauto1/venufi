import Footer from "../components/Footer";
import { VenuesContent } from "./VenuesContent";

export default function VenuesPage() {
  return (
    <div className="flex flex-col min-h-screen flex-1 bg-background">
      {/* ─── Header ─── */}
      <section className="flex flex-col items-center text-center px-6 pt-32 pb-16">
        <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Venue Explorer
        </span>

        <h1 className="text-5xl sm:text-6xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
          Browse Venues
        </h1>

        <p className="mt-5 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
          Explore all VenueFi campaigns deployed through the protocol.
        </p>
      </section>

      {/* ─── Main Content (client boundary) ─── */}
      <VenuesContent />

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}
