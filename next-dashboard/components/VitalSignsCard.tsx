import type { VitalSignsData } from "../types/market";
import { formatMarketValue, formatNumber, formatPercent } from "../lib/formatters";

type VitalSignsCardProps = {
  /**
   * The symbol being displayed, such as AAPL, JFC.PS, or EURUSD.
   */
  symbol: string;

  /**
   * Beginner-facing fundamentals. Some fields can be null because forex pairs
   * and some PSE symbols may not expose every fundamental metric.
   */
  data: VitalSignsData;
};

type VitalSignItem = {
  label: string;
  value: string;
  helper: string;
};

export function VitalSignsCard({ symbol, data }: VitalSignsCardProps) {
  const signs: VitalSignItem[] = [
    {
      label: "P/E Ratio",
      value: formatNumber(data.peRatio),
      helper: "Shows how much investors pay for each unit of company earnings."
    },
    {
      label: "Market Cap",
      value: formatMarketValue(data.marketCap, data.currency),
      helper: "The total stock-market value of the company."
    },
    {
      label: "Dividend Yield",
      value: formatPercent(data.dividendYield),
      helper: "The yearly dividend income compared with the stock price."
    },
    {
      label: "1-Year Growth",
      value: formatPercent(data.oneYearGrowth),
      helper: "How much the price changed over the past year."
    }
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-teal-700">Vital Signs</p>
          <h2 className="text-xl font-bold text-slate-950">{symbol}</h2>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
          Beginner View
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {signs.map((sign) => (
          <div key={sign.label} className="rounded-md border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <dt className="text-xs font-bold uppercase text-slate-500">{sign.label}</dt>

              {/* Placeholder for the future Jargon-Buster tooltip component.
                  Replace this span with <JargonTooltip label={sign.label} body={sign.helper} />
                  once the shared tooltip component is built. */}
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
                title={sign.helper}
                aria-label={`${sign.label}: ${sign.helper}`}
              >
                ?
              </span>
            </div>

            <dd className="text-2xl font-bold text-slate-950">{sign.value}</dd>
          </div>
        ))}
      </div>
    </section>
  );
}
