import Footer from "../../../components/Footer";
import { AdminContent } from "./AdminContent";

interface AdminPageProps {
  params: Promise<{ address: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { address } = await params;

  return (
    <div className="flex flex-col min-h-screen flex-1 bg-background">
      {/* ─── Header ─── */}
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

      {/* ─── Admin Content (client boundary) ─── */}
      <AdminContent venueAddress={address} />

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}
