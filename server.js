const express = require("express");
const path = require("path");
const yahooFinance = require("yahoo-finance2").default;
const {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  ATR
} = require("technicalindicators");

const app = express();
const PORT = process.env.PORT || 3000;

const RANGE_DAYS = {
  "1mo": 32,
  "3mo": 95,
  "6mo": 190,
  "1y": 370,
  "2y": 740,
  "5y": 1850
};

const VALID_INTERVALS = new Set(["1d", "1wk", "1mo"]);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({ results: [] });
  }

  try {
    const result = await yahooFinance.search(q, {
      quotesCount: 10,
      newsCount: 0
    });

    const results = (result.quotes || []).map((item) => ({
      symbol: item.symbol,
      shortname: item.shortname || item.longname || item.name || "",
      exchange: item.exchange || item.exchDisp || "",
      type: item.quoteType || item.typeDisp || "",
      score: item.score || 0
    }));

    res.json({ results });
  } catch (error) {
    res.status(502).json({
      error: "Search failed. The free market data source may be unavailable or rate limited.",
      details: cleanError(error)
    });
  }
});

app.get("/api/analyze", async (req, res) => {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  const range = String(req.query.range || "1y");
  const interval = String(req.query.interval || "1d");

  if (!symbol) {
    return res.status(400).json({ error: "Enter a symbol to analyze." });
  }

  if (!RANGE_DAYS[range]) {
    return res.status(400).json({ error: "Unsupported range." });
  }

  if (!VALID_INTERVALS.has(interval)) {
    return res.status(400).json({ error: "Unsupported interval." });
  }

  const period2 = new Date();
  const period1 = new Date(period2.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);

  try {
    const [quoteResult, summaryResult, historyResult] = await Promise.allSettled([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "assetProfile",
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
          "price"
        ]
      }),
      yahooFinance.historical(symbol, { period1, period2, interval })
    ]);

    const quote = unwrapSettled(quoteResult);
    const summary = unwrapSettled(summaryResult) || {};
    const rawHistory = unwrapSettled(historyResult) || [];

    const history = rawHistory
      .filter((row) => row && row.date && isFiniteNumber(row.close))
      .map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        open: toNumber(row.open),
        high: toNumber(row.high),
        low: toNumber(row.low),
        close: toNumber(row.close),
        volume: toNumber(row.volume)
      }));

    if (!quote && history.length === 0) {
      return res.status(404).json({
        error: "No market data found for this symbol. Try the Yahoo Finance ticker format, such as BTC-USD or EURUSD=X."
      });
    }

    const fundamentals = buildFundamentals(quote, summary);
    const technicals = buildTechnicals(history);
    const performance = buildPerformance(history);
    const analysis = buildAnalysis(fundamentals, technicals, performance, quote);

    res.json({
      symbol,
      asOf: new Date().toISOString(),
      quote: buildQuote(quote, history),
      fundamentals,
      technicals,
      performance,
      analysis,
      history,
      warnings: buildWarnings(quoteResult, summaryResult, historyResult, history, fundamentals)
    });
  } catch (error) {
    res.status(502).json({
      error: "Analysis failed. The free market data source may be unavailable or rate limited.",
      details: cleanError(error)
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Global Market Analyzer running at http://localhost:${PORT}`);
});

function unwrapSettled(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function buildQuote(quote, history) {
  const last = history[history.length - 1] || {};
  return {
    symbol: quote?.symbol || "",
    name: quote?.longName || quote?.shortName || quote?.displayName || "",
    type: quote?.quoteType || "",
    exchange: quote?.fullExchangeName || quote?.exchange || "",
    currency: quote?.currency || "",
    price: toNumber(quote?.regularMarketPrice ?? last.close),
    change: toNumber(quote?.regularMarketChange),
    changePercent: toNumber(quote?.regularMarketChangePercent),
    marketState: quote?.marketState || "",
    previousClose: toNumber(quote?.regularMarketPreviousClose),
    dayHigh: toNumber(quote?.regularMarketDayHigh),
    dayLow: toNumber(quote?.regularMarketDayLow),
    volume: toNumber(quote?.regularMarketVolume ?? last.volume)
  };
}

function buildFundamentals(quote, summary) {
  const detail = summary.summaryDetail || {};
  const stats = summary.defaultKeyStatistics || {};
  const financial = summary.financialData || {};
  const profile = summary.assetProfile || {};
  const price = summary.price || {};

  return {
    sector: profile.sector || "",
    industry: profile.industry || "",
    country: profile.country || "",
    website: profile.website || "",
    marketCap: firstNumber(price.marketCap, detail.marketCap, quote?.marketCap),
    trailingPE: firstNumber(detail.trailingPE, stats.trailingPE, quote?.trailingPE),
    forwardPE: firstNumber(detail.forwardPE, stats.forwardPE, quote?.forwardPE),
    eps: firstNumber(stats.trailingEps, quote?.epsTrailingTwelveMonths),
    revenueGrowth: firstNumber(financial.revenueGrowth),
    earningsGrowth: firstNumber(financial.earningsGrowth),
    dividendYield: firstNumber(detail.dividendYield, quote?.dividendYield),
    beta: firstNumber(detail.beta, stats.beta, quote?.beta),
    bookValue: firstNumber(stats.bookValue, quote?.bookValue),
    debtToEquity: firstNumber(financial.debtToEquity),
    profitMargin: firstNumber(financial.profitMargins),
    returnOnEquity: firstNumber(financial.returnOnEquity),
    currentRatio: firstNumber(financial.currentRatio),
    recommendation: financial.recommendationKey || ""
  };
}

function buildTechnicals(history) {
  const closes = history.map((item) => item.close);
  const highs = history.map((item) => item.high);
  const lows = history.map((item) => item.low);
  const current = closes[closes.length - 1];

  const sma20 = lastValue(SMA.calculate({ period: 20, values: closes }));
  const sma50 = lastValue(SMA.calculate({ period: 50, values: closes }));
  const sma200 = lastValue(SMA.calculate({ period: 200, values: closes }));
  const ema20 = lastValue(EMA.calculate({ period: 20, values: closes }));
  const rsi14 = lastValue(RSI.calculate({ period: 14, values: closes }));
  const macd = lastValue(MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  }));
  const bands = lastValue(BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2
  }));
  const atr14 = lastValue(ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  }));

  return {
    close: toNumber(current),
    sma20: toNumber(sma20),
    sma50: toNumber(sma50),
    sma200: toNumber(sma200),
    ema20: toNumber(ema20),
    rsi14: toNumber(rsi14),
    macd: {
      macd: toNumber(macd?.MACD),
      signal: toNumber(macd?.signal),
      histogram: toNumber(macd?.histogram)
    },
    bollinger: {
      upper: toNumber(bands?.upper),
      middle: toNumber(bands?.middle),
      lower: toNumber(bands?.lower)
    },
    atr14: toNumber(atr14),
    aboveSma20: isFiniteNumber(current) && isFiniteNumber(sma20) ? current > sma20 : null,
    aboveSma50: isFiniteNumber(current) && isFiniteNumber(sma50) ? current > sma50 : null,
    aboveSma200: isFiniteNumber(current) && isFiniteNumber(sma200) ? current > sma200 : null
  };
}

function buildPerformance(history) {
  const close = history[history.length - 1]?.close;
  return {
    oneDay: pctChangeFromOffset(history, 1, close),
    oneWeek: pctChangeFromOffset(history, 5, close),
    oneMonth: pctChangeFromOffset(history, 21, close),
    threeMonth: pctChangeFromOffset(history, 63, close),
    ytd: pctChangeFromStartOfYear(history, close)
  };
}

function buildAnalysis(fundamentals, technicals, performance, quote) {
  const fundamentalFactors = [];
  const technicalFactors = [];
  let fundamentalScore = 0;
  let technicalScore = 0;

  const pe = firstNumber(fundamentals.trailingPE, fundamentals.forwardPE);
  if (isFiniteNumber(pe)) {
    if (pe > 0 && pe < 18) {
      fundamentalScore += 1;
      fundamentalFactors.push(`Valuation looks moderate with PE near ${formatNumber(pe)}.`);
    } else if (pe > 45) {
      fundamentalScore -= 1;
      fundamentalFactors.push(`PE near ${formatNumber(pe)} suggests valuation risk.`);
    } else {
      fundamentalFactors.push(`PE near ${formatNumber(pe)} is neither clearly cheap nor extreme.`);
    }
  }

  addGrowthFactor(fundamentalFactors, "Revenue growth", fundamentals.revenueGrowth, (score) => {
    fundamentalScore += score;
  });
  addGrowthFactor(fundamentalFactors, "Earnings growth", fundamentals.earningsGrowth, (score) => {
    fundamentalScore += score;
  });

  if (isFiniteNumber(fundamentals.profitMargin)) {
    if (fundamentals.profitMargin > 0.15) {
      fundamentalScore += 1;
      fundamentalFactors.push("Profit margins are strong.");
    } else if (fundamentals.profitMargin < 0) {
      fundamentalScore -= 1;
      fundamentalFactors.push("Profit margins are negative.");
    }
  }

  if (isFiniteNumber(fundamentals.debtToEquity)) {
    if (fundamentals.debtToEquity > 180) {
      fundamentalScore -= 1;
      fundamentalFactors.push("Debt-to-equity is elevated.");
    } else if (fundamentals.debtToEquity < 80) {
      fundamentalScore += 0.5;
      fundamentalFactors.push("Debt-to-equity appears manageable.");
    }
  }

  if (!fundamentalFactors.length) {
    fundamentalFactors.push("Fundamental data is limited for this asset type.");
  }

  if (technicals.aboveSma20 === true) {
    technicalScore += 1;
    technicalFactors.push("Price is above the 20-period moving average.");
  } else if (technicals.aboveSma20 === false) {
    technicalScore -= 1;
    technicalFactors.push("Price is below the 20-period moving average.");
  }

  if (technicals.aboveSma50 === true) {
    technicalScore += 1;
    technicalFactors.push("Price is above the 50-period moving average.");
  } else if (technicals.aboveSma50 === false) {
    technicalScore -= 1;
    technicalFactors.push("Price is below the 50-period moving average.");
  }

  if (technicals.aboveSma200 === true) {
    technicalScore += 1;
    technicalFactors.push("Long-term trend is positive versus the 200-period average.");
  } else if (technicals.aboveSma200 === false) {
    technicalScore -= 1;
    technicalFactors.push("Long-term trend is negative versus the 200-period average.");
  }

  if (isFiniteNumber(technicals.rsi14)) {
    if (technicals.rsi14 > 70) {
      technicalScore -= 0.5;
      technicalFactors.push("RSI is overbought, which can signal stretched momentum.");
    } else if (technicals.rsi14 < 30) {
      technicalScore += 0.5;
      technicalFactors.push("RSI is oversold, which can signal a potential rebound setup.");
    } else {
      technicalFactors.push("RSI is in a neutral momentum zone.");
    }
  }

  if (isFiniteNumber(technicals.macd.histogram)) {
    if (technicals.macd.histogram > 0) {
      technicalScore += 1;
      technicalFactors.push("MACD momentum is positive.");
    } else if (technicals.macd.histogram < 0) {
      technicalScore -= 1;
      technicalFactors.push("MACD momentum is negative.");
    }
  }

  if (isFiniteNumber(performance.oneMonth)) {
    if (performance.oneMonth > 5) {
      technicalScore += 0.5;
      technicalFactors.push("One-month performance is positive.");
    } else if (performance.oneMonth < -5) {
      technicalScore -= 0.5;
      technicalFactors.push("One-month performance is weak.");
    }
  }

  if (!technicalFactors.length) {
    technicalFactors.push("More price history is needed for a reliable technical view.");
  }

  const weightedScore = quote?.quoteType === "EQUITY"
    ? fundamentalScore * 0.45 + technicalScore * 0.55
    : fundamentalScore * 0.25 + technicalScore * 0.75;

  const rating = weightedScore >= 1.25
    ? "Bullish"
    : weightedScore <= -1.25
      ? "Bearish"
      : "Neutral";

  return {
    rating,
    totalScore: round(weightedScore),
    fundamentalScore: round(fundamentalScore),
    technicalScore: round(technicalScore),
    fundamentalFactors,
    technicalFactors,
    caveat: "Educational analysis only. Data may be delayed, incomplete, or unavailable for some global assets. This is not financial advice."
  };
}

function buildWarnings(quoteResult, summaryResult, historyResult, history, fundamentals) {
  const warnings = [];

  if (quoteResult.status === "rejected") {
    warnings.push("Live quote data was unavailable.");
  }
  if (summaryResult.status === "rejected" || !hasFundamentalData(fundamentals)) {
    warnings.push("Fundamental data is limited or unavailable for this symbol.");
  }
  if (historyResult.status === "rejected" || history.length < 30) {
    warnings.push("Technical analysis is limited because price history is short or unavailable.");
  }

  return warnings;
}

function hasFundamentalData(fundamentals) {
  return [
    fundamentals.marketCap,
    fundamentals.trailingPE,
    fundamentals.forwardPE,
    fundamentals.eps,
    fundamentals.revenueGrowth,
    fundamentals.profitMargin
  ].some(isFiniteNumber);
}

function addGrowthFactor(factors, label, value, addScore) {
  if (!isFiniteNumber(value)) return;
  if (value > 0.08) {
    addScore(1);
    factors.push(`${label} is positive.`);
  } else if (value < -0.05) {
    addScore(-1);
    factors.push(`${label} is contracting.`);
  } else {
    factors.push(`${label} is modest.`);
  }
}

function pctChangeFromOffset(history, offset, close) {
  if (!isFiniteNumber(close) || history.length <= offset) return null;
  const previous = history[history.length - 1 - offset]?.close;
  if (!isFiniteNumber(previous) || previous === 0) return null;
  return round(((close - previous) / previous) * 100);
}

function pctChangeFromStartOfYear(history, close) {
  if (!isFiniteNumber(close) || !history.length) return null;
  const year = new Date().getFullYear();
  const firstThisYear = history.find((item) => Number(item.date.slice(0, 4)) === year);
  if (!firstThisYear || !isFiniteNumber(firstThisYear.close) || firstThisYear.close === 0) return null;
  return round(((close - firstThisYear.close) / firstThisYear.close) * 100);
}

function firstNumber(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (isFiniteNumber(number)) return number;
  }
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const number = typeof value === "object" && value.raw !== undefined
    ? Number(value.raw)
    : Number(value);
  return Number.isFinite(number) ? round(number) : null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function lastValue(values) {
  return Array.isArray(values) && values.length ? values[values.length - 1] : null;
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function cleanError(error) {
  return error?.message || "Unknown error";
}
