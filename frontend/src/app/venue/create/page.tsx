import Footer from "../../components/Footer";
import { CreateVenueContent } from "./CreateVenueContent";

export default function CreateVenuePage() {
  return (
    <div className="flex flex-col min-h-screen flex-1 bg-background">
      {/* ─── Header ─── */}
      <section className="flex flex-col items-center text-center px-6 pt-32 pb-16">
        <span className="inline-block text-[13px] font-normal tracking-[0.3em] uppercase text-text-secondary mb-5 font-sans">
          Deploy Campaign
        </span>

        <h1 className="text-5xl sm:text-6xl font-light tracking-[-0.02em] text-text-primary leading-[1.1] font-serif">
          Create a Venue
        </h1>

        <p className="mt-5 max-w-lg text-[17px] leading-[1.8] text-text-secondary font-sans font-light">
          Deploy a new VenueFi revenue-sharing campaign directly on-chain.
        </p>
      </section>

      {/* ─── Main Content (client boundary) ─── */}
      <CreateVenueContent />

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}
