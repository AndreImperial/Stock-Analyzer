# Global Market Analyzer

A local web app for educational analysis of Yahoo Finance-compatible symbols across stocks, ETFs, crypto, forex, and indexes.

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

The app uses free market data, so availability, delay, and field coverage vary by asset type and symbol.

## Optional AI Summaries

The app works without AI and falls back to a rules-based beginner summary.

### Free local Ollama summaries

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

Render cannot reach your laptop's `localhost`. To use Ollama on Render, set `OLLAMA_BASE_URL` to a reachable hosted Ollama server URL.

### OpenAI summaries

To enable OpenAI-powered summaries instead, set:

```powershell
$env:OPENAI_API_KEY="your_key_here"
$env:OPENAI_MODEL="gpt-5.5"
```

On Render, add the same values in the service environment variables. The app never sends AI provider keys to the browser.

## Deploy on Render

This repo includes `render.yaml`, so Render can create the web service from the blueprint.

1. Open Render and choose **New +** then **Blueprint**.
2. Connect `AndreImperial/Stock-Analyzer`.
3. Select the `main` branch.
4. Apply the blueprint.

Render will run `npm install` and start the app with `npm start`.
