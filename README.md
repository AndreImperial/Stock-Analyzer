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

## Deploy on Render

This repo includes `render.yaml`, so Render can create the web service from the blueprint.

1. Open Render and choose **New +** then **Blueprint**.
2. Connect `AndreImperial/Stock-Analyzer`.
3. Select the `main` branch.
4. Apply the blueprint.

Render will run `npm install` and start the app with `npm start`.
