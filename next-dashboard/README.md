# Beginner Fundamentals & Technicals Screener

## Stack Recommendation

React with Next.js and TailwindCSS is a strong fit for this dashboard.

- Next.js gives clean routing, server-side data loading, and API routes for market-data adapters.
- TailwindCSS is fast for building consistent beginner-friendly UI states such as green/yellow/red risk meters.
- Lightweight Charts is a better charting choice than Recharts for price charts because it is built for financial time-series charts and handles overlays like 50-day and 200-day SMAs cleanly.

For data, use provider adapters behind one internal API because US stocks, Philippine stocks, and forex pairs usually require different sources and ticker formats.

## Initial Folder Structure

```text
next-dashboard/
  app/
    layout.tsx
    page.tsx
    screener/
      page.tsx
    symbol/
      [symbol]/
        page.tsx
    api/
      market/
        route.ts
      screener/
        route.ts
  components/
    VitalSignsCard.tsx
    JargonTooltip.tsx
    RiskMeter.tsx
    PriceChart.tsx
    Watchlist.tsx
    MarketStatusPill.tsx
  lib/
    market-data/
      index.ts
      us-stocks.ts
      pse-stocks.ts
      forex.ts
    indicators/
      sma.ts
      rsi.ts
    formatters.ts
  types/
    market.ts
```

This keeps UI components separate from market-data adapters, which matters because PSE, US equities, and forex will not all expose the same fundamentals.
