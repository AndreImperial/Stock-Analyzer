import { JargonTooltip } from "./JargonTooltip";
import type { AssetMarket, VitalSignsData, VitalSignStatus } from "../types/market";
import { formatMarketValue, formatNumber, formatPercent } from "../lib/formatters";

type VitalSignsCardProps = {
  /**
   * The symbol being displayed, such as AAPL, JFC.PS, or EURUSD.
   */
  symbol: string;

  /**
   * Optional company/security name shown below the symbol.
   */
  name?: string;

  /**
   * Market context matters because forex pairs do not have stock fundamentals,
   * and PSE market caps are usually displayed in PHP.
   */
  market?: AssetMarket;

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
  status: VitalSignStatus;
  note: string;
};

const statusClasses: Record<VitalSignStatus, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  risk: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  unavailable: "border-slate-200 bg-slate-50 text-slate-500"
};

const statusLabels: Record<VitalSignStatus, string> = {
  good: "Healthy",
  watch: "Watch",
  risk: "Risk",
  neutral: "Neutral",
  unavailable: "Missing"
};

export function VitalSignsCard({ symbol, name, market = "US", data }: VitalSignsCardProps) {
  const signs: VitalSignItem[] = [
    {
      label: "P/E Ratio",
      value: formatNumber(data.peRatio),
      helper: "Shows how much investors pay for each unit of company earnings.",
      status: getPeStatus(data.peRatio),
      note: getPeNote(data.peRatio, market)
    },
    {
      label: "Market Cap",
      value: formatMarketValue(data.marketCap, data.currency),
      helper: "The total stock-market value of the company.",
      status: getMarketCapStatus(data.marketCap, market),
      note: getMarketCapNote(data.marketCap, market)
    },
    {
      label: "Dividend Yield",
      value: formatPercent(data.dividendYield),
      helper: "The yearly dividend income compared with the stock price.",
      status: getDividendStatus(data.dividendYield, market),
      note: getDividendNote(data.dividendYield, market)
    },
    {
      label: "1-Year Growth",
      value: formatPercent(data.oneYearGrowth),
      helper: "How much the price changed over the past year.",
      status: getGrowthStatus(data.oneYearGrowth),
      note: getGrowthNote(data.oneYearGrowth)
    }
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-label={`${symbol} vital signs`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-teal-700">Vital Signs</p>
          <h2 className="text-xl font-bold text-slate-950">
            {symbol}
          </h2>
          {name ? <p className="mt-1 text-sm font-medium text-slate-500">{name}</p> : null}
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
          {market} Beginner View
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {signs.map((sign) => (
          <div key={sign.label} className="rounded-md border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <dt className="text-xs font-bold uppercase text-slate-500">{sign.label}</dt>
              <JargonTooltip term={sign.label} explanation={sign.helper} />
            </div>

            <dd className="text-2xl font-bold text-slate-950">{sign.value}</dd>
            <p className="mt-3 text-sm leading-5 text-slate-600">{sign.note}</p>
            <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[sign.status]}`}>
              {statusLabels[sign.status]}
            </span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function getPeStatus(value: number | null): VitalSignStatus {
  if (!Number.isFinite(value) || value === null || value <= 0) return "unavailable";
  if (value < 25) return "good";
  if (value <= 40) return "watch";
  return "risk";
}

function getPeNote(value: number | null, market: AssetMarket) {
  if (market === "Forex") return "Forex pairs do not have company earnings, so P/E usually does not apply.";
  if (!Number.isFinite(value) || value === null || value <= 0) return "P/E is unavailable or not meaningful for this symbol.";
  if (value < 25) return "A lower P/E can mean the price is reasonable compared with earnings.";
  if (value <= 40) return "This P/E is not extreme, but beginners should compare it with similar companies.";
  return "A high P/E can mean investors expect fast growth, but it also raises valuation risk.";
}

function getMarketCapStatus(value: number | null, market: AssetMarket): VitalSignStatus {
  if (market === "Forex") return "neutral";
  if (!Number.isFinite(value) || value === null || value <= 0) return "unavailable";
  const thresholds = market === "PSE"
    ? { good: 100_000_000_000, watch: 20_000_000_000 }
    : { good: 10_000_000_000, watch: 1_000_000_000 };
  if (value >= thresholds.good) return "good";
  if (value >= thresholds.watch) return "watch";
  return "risk";
}

function getMarketCapNote(value: number | null, market: AssetMarket) {
  if (market === "Forex") return "Forex pairs are currency markets, not companies, so market cap does not apply.";
  if (!Number.isFinite(value) || value === null || value <= 0) return "Market cap is unavailable from the current data source.";
  const thresholds = market === "PSE"
    ? { good: 100_000_000_000, watch: 20_000_000_000 }
    : { good: 10_000_000_000, watch: 1_000_000_000 };
  if (value >= thresholds.good) return "Larger companies are often more established, though they can still decline.";
  if (value >= thresholds.watch) return "Mid-sized companies may offer growth, but can move more sharply.";
  return "Small companies can be volatile, so beginners should be extra careful.";
}

function getDividendStatus(value: number | null, market: AssetMarket): VitalSignStatus {
  if (market === "Forex") return "neutral";
  if (!Number.isFinite(value) || value === null || value < 0) return "unavailable";
  if (value === 0) return "neutral";
  if (value <= 0.06) return "good";
  return "watch";
}

function getDividendNote(value: number | null, market: AssetMarket) {
  if (market === "Forex") return "Forex pairs do not pay company dividends.";
  if (!Number.isFinite(value) || value === null || value < 0) return "Dividend yield is unavailable from the current data source.";
  if (value === 0) return "This stock is not currently showing a dividend yield.";
  if (value <= 0.06) return "A moderate dividend yield can support long-term income.";
  return "Very high yields can be a warning sign if the payout is not sustainable.";
}

function getGrowthStatus(value: number | null): VitalSignStatus {
  if (!Number.isFinite(value) || value === null) return "unavailable";
  if (value > 0.1) return "good";
  if (value >= -0.1) return "neutral";
  return "risk";
}

function getGrowthNote(value: number | null) {
  if (!Number.isFinite(value) || value === null) return "One-year performance is unavailable from the current data source.";
  if (value > 0.1) return "The price is meaningfully higher than one year ago.";
  if (value >= 0) return "The price is slightly higher than one year ago.";
  if (value >= -0.1) return "The price is slightly lower than one year ago.";
  return "The price is down more than 10% over the past year.";
}
