# Global Market Analyzer

A free-only Express web app for educational analysis of Yahoo Finance-compatible symbols across stocks, ETFs, Philippine stocks, crypto, forex, and indexes.

The app is built for beginner investors. It includes vital signs, jargon tooltips, risk meters, chart overlays, latest-news links from public sources, a watchlist stored in the browser, and preset screeners. It never requires paid API keys and never gives buy/sell/hold instructions.

## Run

```powershell
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Example Symbols

- `AAPL` for an equity
- `SPY` for an ETF
- `BTC-USD` for crypto
- `EURUSD=X` for forex
- `^GSPC` for an index
- `JFC.PS` or `SM.PS` for Philippine stocks when Yahoo-compatible data is available

The app uses free market data, so availability, delay, and field coverage vary by asset type and symbol.

## Free AI Summaries

The app works without AI and falls back to a deterministic rules-based beginner summary. No paid AI provider is part of the main product path.

### Local or self-hosted Ollama

Install Ollama, pull a model, and start Ollama locally:

```powershell
ollama pull llama3.1
ollama serve
```

Then run this app with:

```powershell
$env:OLLAMA_ENABLED="true"
$env:OLLAMA_BASE_URL="http://localhost:11434"
$env:OLLAMA_MODEL="llama3.1"
npm start
```

Check status:

```text
http://localhost:3000/api/ai/status
```

Render cannot reach your laptop's `localhost`. To use Ollama on Render, set `OLLAMA_BASE_URL` to a reachable user-managed Ollama-compatible endpoint. If Ollama is offline or unavailable, the deployed app stays live and uses rules summaries.

## Screener Presets

- Default universe
- Stable dividend
- Momentum
- Oversold watch
- Low volatility
- Forex majors
- Philippine stocks

## Deploy on Render

This repo includes `render.yaml`, so Render can create the web service from the blueprint.

1. Open Render and choose **New +** then **Blueprint**.
2. Connect `AndreImperial/Stock-Analyzer`.
3. Select the `main` branch.
4. Apply the blueprint.

Render will run `npm install` and start the app with `npm start`.
