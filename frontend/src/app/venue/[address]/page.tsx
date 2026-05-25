import Footer from "../../components/Footer";
import { ConnectButton } from "../../components/ConnectButton";
import { VenueOverview } from "./VenueOverview";

interface VenuePageProps {
  params: Promise<{ address: string }>;
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { address } = await params;

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

        {/* ─── Venue Overview (client boundary) ─── */}
        <VenueOverview venueAddress={address} />
      </section>

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}
