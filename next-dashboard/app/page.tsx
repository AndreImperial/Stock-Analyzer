import { VitalSignsCard } from "../components/VitalSignsCard";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <VitalSignsCard
          symbol="AAPL"
          name="Apple Inc."
          market="US"
          data={{
            peRatio: 30.2,
            marketCap: 2_850_000_000_000,
            dividendYield: 0.005,
            oneYearGrowth: 0.18,
            currency: "USD"
          }}
        />
      </div>
    </main>
  );
}
