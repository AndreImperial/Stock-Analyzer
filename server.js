const express = require("express");
const path = require("path");
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
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_SCREENER_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "AVGO",
  "JPM",
  "V",
  "LLY",
  "WMT",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "GLD",
  "TLT",
  "BTC-USD",
  "ETH-USD",
  "EURUSD=X",
  "GBPUSD=X",
  "JPY=X",
  "^GSPC",
  "^IXIC",
  "^DJI"
];
const SCREENER_PRESETS = {
  default: {
    label: "Default universe",
    symbols: DEFAULT_SCREENER_SYMBOLS
  },
  "stable-dividend": {
    label: "Stable dividend",
    symbols: ["AAPL", "MSFT", "JPM", "VZ", "KO", "PG", "JNJ", "PEP", "WMT", "SPY", "DIA"]
  },
  momentum: {
    label: "Momentum",
    symbols: ["AAPL", "MSFT", "NVDA", "AVGO", "AMZN", "META", "QQQ", "SPY", "BTC-USD", "ETH-USD"]
  },
  "oversold-watch": {
    label: "Oversold watch",
    symbols: ["AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "META", "JPM", "IWM", "QQQ", "SPY"]
  },
  "low-volatility": {
    label: "Low volatility",
    symbols: ["SPY", "DIA", "WMT", "PG", "KO", "PEP", "JNJ", "V", "TLT", "GLD"]
  },
  "forex-majors": {
    label: "Forex majors",
    symbols: ["EURUSD=X", "GBPUSD=X", "JPY=X", "AUDUSD=X", "NZDUSD=X", "CAD=X", "CHF=X", "EURJPY=X"]
  },
  pse: {
    label: "Philippine stocks",
    symbols: ["JFC.PS", "SM.PS", "ALI.PS", "BDO.PS", "BPI.PS", "TEL.PS", "AC.PS", "ICT.PS", "SMPH.PS", "MER.PS"]
  }
};

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({ results: [] });
  }

  try {
    const result = await yahooSearch(q);

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

app.get("/api/news", async (req, res) => {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  const q = symbol || String(req.query.q || "markets").trim();

  try {
    const result = await yahooSearch(q, { quotesCount: 0, newsCount: 10 });
    const news = (result.news || []).map((item) => ({
      title: item.title || "",
      publisher: item.publisher || "",
      link: item.link || "",
      providerPublishTime: item.providerPublishTime || null,
      publishedAt: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : null,
      type: item.type || "",
      thumbnail: item.thumbnail?.resolutions?.[0]?.url || ""
    })).filter((item) => item.title && item.link);

    res.json({
      symbol,
      query: q,
      asOf: new Date().toISOString(),
      news
    });
  } catch (error) {
    res.status(502).json({
      error: "Latest news is unavailable from the free data source right now.",
      details: cleanError(error)
    });
  }
});

app.get("/api/ai/status", async (req, res) => {
  const configured = process.env.OLLAMA_ENABLED === "true" || Boolean(process.env.OLLAMA_BASE_URL);
  if (!configured) {
    return res.json({
      provider: "Rules",
      status: "fallback",
      label: "Rules fallback",
      model: null,
      baseUrl: null
    });
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map((model) => model.name);

    res.json({
      provider: "Ollama",
      status: "active",
      label: "Ollama active",
      model: OLLAMA_MODEL,
      baseUrl: redactLocalUrl(OLLAMA_BASE_URL),
      models
    });
  } catch (error) {
    res.json({
      provider: "Rules",
      status: "unavailable",
      label: "Rules fallback",
      model: OLLAMA_MODEL,
      baseUrl: redactLocalUrl(OLLAMA_BASE_URL),
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

  try {
    res.json(await analyzeSymbol(symbol, range, interval, true));
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      error: status === 404
        ? error.message
        : "Analysis failed. The free market data source may be unavailable or rate limited.",
      details: cleanError(error)
    });
  }
});

app.get("/api/screener", async (req, res) => {
  const range = String(req.query.range || "6mo");
  const interval = String(req.query.interval || "1d");
  const minimumScore = Number(req.query.minScore ?? -99);
  const ratingFilter = String(req.query.rating || "All");
  const preset = String(req.query.preset || "default");
  const symbols = parseScreenerSymbols(req.query.symbols, preset);

  if (!RANGE_DAYS[range]) {
    return res.status(400).json({ error: "Unsupported range." });
  }

  if (!VALID_INTERVALS.has(interval)) {
    return res.status(400).json({ error: "Unsupported interval." });
  }

  try {
    const settled = await mapWithConcurrency(symbols, 5, async (symbol) => {
      try {
        return await analyzeSymbol(symbol, range, interval, false);
      } catch (error) {
        return {
          symbol,
          error: cleanError(error)
        };
      }
    });

    const rows = settled
      .filter((item) => !item.error)
      .map((item) => ({
        symbol: item.symbol,
        name: item.quote.name,
        type: item.quote.type,
        exchange: item.quote.exchange,
        price: item.quote.price,
        volume: item.quote.volume,
        rating: item.analysis.rating,
        totalScore: item.analysis.totalScore,
        fundamentalScore: item.analysis.fundamentalScore,
        technicalScore: item.analysis.technicalScore,
        dividendYield: item.fundamentals.dividendYield,
        volatility: item.risk.volatility.value,
        volatilityLevel: item.risk.volatility.level,
        oneMonth: item.performance.oneMonth,
        threeMonth: item.performance.threeMonth,
        ytd: item.performance.ytd,
        rsi14: item.technicals.rsi14,
        aboveSma50: item.technicals.aboveSma50,
        aboveSma200: item.technicals.aboveSma200,
        factors: [
          ...(item.analysis.technicalFactors || []),
          ...(item.analysis.fundamentalFactors || [])
        ].slice(0, 3)
      }))
      .filter((row) => row.totalScore >= minimumScore)
      .filter((row) => ratingFilter === "All" || row.rating === ratingFilter)
      .filter((row) => rowMatchesPreset(row, preset))
      .sort((a, b) => comparePresetRows(a, b, preset));

    res.json({
      asOf: new Date().toISOString(),
      preset,
      presetLabel: SCREENER_PRESETS[preset]?.label || "Custom",
      scanned: symbols.length,
      matched: rows.length,
      rows,
      failures: settled.filter((item) => item.error)
    });
  } catch (error) {
    res.status(502).json({
      error: "Screener failed. Try fewer symbols or a shorter range.",
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

function mergeQuoteFallbacks(primaryQuote, nasdaq) {
  if (!nasdaq) return primaryQuote;
  return {
    ...(primaryQuote || {}),
    symbol: primaryQuote?.symbol || nasdaq.symbol,
    shortName: primaryQuote?.shortName || nasdaq.companyName,
    longName: primaryQuote?.longName || nasdaq.companyName,
    quoteType: primaryQuote?.quoteType || nasdaq.quoteType,
    fullExchangeName: primaryQuote?.fullExchangeName || nasdaq.exchange,
    exchange: primaryQuote?.exchange || nasdaq.exchange,
    regularMarketPrice: firstNumber(primaryQuote?.regularMarketPrice, nasdaq.price),
    regularMarketChange: firstNumber(primaryQuote?.regularMarketChange, nasdaq.change),
    regularMarketChangePercent: firstNumber(primaryQuote?.regularMarketChangePercent, nasdaq.changePercent),
    regularMarketPreviousClose: firstNumber(primaryQuote?.regularMarketPreviousClose, nasdaq.previousClose),
    regularMarketVolume: firstNumber(primaryQuote?.regularMarketVolume, nasdaq.volume),
    marketState: primaryQuote?.marketState || nasdaq.marketState,
    currency: primaryQuote?.currency || nasdaq.currency || ""
  };
}

function mergeSummaryFallbacks(primarySummary, nasdaq) {
  if (!nasdaq) return primarySummary || {};
  const summary = primarySummary || {};
  return {
    ...summary,
    assetProfile: {
      ...(summary.assetProfile || {}),
      sector: summary.assetProfile?.sector || nasdaq.sector || "",
      industry: summary.assetProfile?.industry || nasdaq.industry || ""
    },
    summaryDetail: {
      ...(summary.summaryDetail || {}),
      marketCap: firstNumber(summary.summaryDetail?.marketCap, nasdaq.marketCap),
      dividendYield: firstNumber(summary.summaryDetail?.dividendYield, nasdaq.dividendYield)
    },
    price: {
      ...(summary.price || {}),
      marketCap: firstNumber(summary.price?.marketCap, nasdaq.marketCap)
    }
  };
}

async function analyzeSymbol(symbol, range, interval, includeHistory) {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);

  const [quoteResult, summaryResult, nasdaqResult, historyResult] = await Promise.allSettled([
    yahooQuote(symbol),
    yahooQuoteSummary(symbol, [
      "assetProfile",
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "price"
    ]),
    nasdaqSummary(symbol),
    yahooHistorical(symbol, { period1, period2, interval })
  ]);

  const quote = mergeQuoteFallbacks(unwrapSettled(quoteResult), unwrapSettled(nasdaqResult));
  const summary = mergeSummaryFallbacks(unwrapSettled(summaryResult), unwrapSettled(nasdaqResult));
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
    const error = new Error("No market data found for this symbol. Try the Yahoo Finance ticker format, such as BTC-USD or EURUSD=X.");
    error.statusCode = 404;
    throw error;
  }

  const fundamentals = buildFundamentals(quote, summary);
  const technicals = buildTechnicals(history);
  const performance = buildPerformance(history);
  const analysis = buildAnalysis(fundamentals, technicals, performance, quote);
  const finalQuote = buildQuote(quote, history, symbol);
  const risk = buildRiskProfile(fundamentals, technicals);
  const bottomLine = includeHistory
    ? await buildBottomLine({ symbol, quote: finalQuote, fundamentals, technicals, performance, analysis, risk })
    : buildBottomLineFallback({ symbol, quote: finalQuote, fundamentals, technicals, performance, analysis, risk });

  return {
    symbol,
    asOf: new Date().toISOString(),
    quote: finalQuote,
    fundamentals,
    technicals,
    performance,
    analysis,
    risk,
    bottomLine,
    history: includeHistory ? history : [],
    warnings: buildWarnings(quoteResult, summaryResult, nasdaqResult, historyResult, history, fundamentals, quote)
  };
}

function buildQuote(quote, history, symbol) {
  const last = history[history.length - 1] || {};
  return {
    symbol: quote?.symbol || symbol || "",
    name: quote?.longName || quote?.shortName || quote?.displayName || quote?.name || "",
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
    oneYear: pctChangeFromOffset(history, 252, close),
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

function buildRiskProfile(fundamentals, technicals) {
  const volatilityPercent = isFiniteNumber(technicals.atr14) && isFiniteNumber(technicals.close) && technicals.close !== 0
    ? round((technicals.atr14 / technicals.close) * 100)
    : null;

  const volatilityLevel = !isFiniteNumber(volatilityPercent)
    ? "Unknown"
    : volatilityPercent < 2
      ? "Low"
      : volatilityPercent < 5
        ? "Medium"
        : "High";

  const debt = fundamentals.debtToEquity;
  const debtLevel = !isFiniteNumber(debt)
    ? "Unknown"
    : debt < 80
      ? "Low"
      : debt < 180
        ? "Medium"
        : "High";

  return {
    volatility: {
      level: volatilityLevel,
      value: volatilityPercent,
      label: isFiniteNumber(volatilityPercent) ? `${formatNumber(volatilityPercent)}% ATR/price` : "Not enough data"
    },
    debt: {
      level: debtLevel,
      value: isFiniteNumber(debt) ? debt : null,
      label: isFiniteNumber(debt) ? `${formatNumber(debt)} debt/equity` : "Not available"
    }
  };
}

async function buildBottomLine(context) {
  const fallback = buildBottomLineFallback(context);

  if (process.env.OLLAMA_ENABLED === "true" || process.env.OLLAMA_BASE_URL) {
    const ollamaText = await generateOllamaBottomLine(context).catch(() => "");
    if (ollamaText) {
      return {
        ...fallback,
        source: "Ollama",
        summary: ollamaText
      };
    }
  }

  return fallback;
}

function buildAiPrompt({ symbol, quote, fundamentals, technicals, performance, analysis, risk }) {
  return [
    "Write a beginner-friendly market summary using only the JSON data below.",
    "Be clear, calm, and educational.",
    "Do not give buy, sell, hold, price target, or personalized financial advice.",
    "Mention uncertainty and missing data when relevant.",
    "Keep it to one short paragraph plus one sentence about what to watch.",
    "",
    JSON.stringify({
      symbol,
      quote,
      fundamentals,
      technicals,
      performance,
      rating: analysis.rating,
      risk
    })
  ].join("\n");
}

async function generateOllamaBottomLine(context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildAiPrompt(context),
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 220
        }
      })
    });

    if (!response.ok) throw new Error(`Ollama request failed with HTTP ${response.status}`);
    const data = await response.json();
    return String(data.response || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

function buildBottomLineFallback({ symbol, quote, fundamentals, technicals, performance, analysis, risk }) {
  const name = quote.name || symbol;
  const type = quote.type || "asset";
  const rating = analysis.rating.toLowerCase();
  const oneMonth = isFiniteNumber(performance.oneMonth) ? `${performance.oneMonth > 0 ? "up" : "down"} ${formatNumber(Math.abs(performance.oneMonth))}% over one month` : "without enough one-month history";
  const trend = technicals.aboveSma50 === true
    ? "trading above its 50-period average"
    : technicals.aboveSma50 === false
      ? "trading below its 50-period average"
      : "without a clear 50-period trend signal";
  const fundamentalsText = hasFundamentalData(fundamentals)
    ? `Core fundamentals show ${fundamentals.sector || "available company"} context, market cap ${formatNumber(fundamentals.marketCap || 0)}, and dividend yield ${isFiniteNumber(fundamentals.dividendYield) ? `${formatNumber(fundamentals.dividendYield * 100)}%` : "not available"}.`
    : "Company fundamentals are limited for this symbol, so the read leans more heavily on price action.";

  return {
    source: "Rules",
    headline: `${name} is currently ${analysis.rating}`,
    summary: `${symbol} is a ${type} with a ${rating} educational score. It is ${oneMonth} and is ${trend}. ${fundamentalsText} Volatility risk is ${risk.volatility.level.toLowerCase()}, while debt risk is ${risk.debt.level.toLowerCase()}. This is a research summary, not a buy or sell recommendation.`,
    watch: buildWatchItems(fundamentals, technicals, performance, risk),
    missingData: buildMissingDataNotes(fundamentals, technicals, performance),
    confidence: buildConfidence(fundamentals, technicals)
  };
}

function buildMissingDataNotes(fundamentals, technicals, performance) {
  const notes = [];
  if (!hasFundamentalData(fundamentals)) {
    notes.push("Fundamentals are limited for this symbol, which is normal for forex, crypto, indexes, and some PSE listings.");
  }
  if (!isFiniteNumber(technicals.sma200)) {
    notes.push("The 200-day trend needs more daily history before it becomes reliable.");
  }
  if (!isFiniteNumber(performance.oneYear)) {
    notes.push("One-year performance is unavailable for the selected range.");
  }
  return notes;
}

function buildWatchItems(fundamentals, technicals, performance, risk) {
  const items = [];
  if (isFiniteNumber(technicals.rsi14) && technicals.rsi14 > 70) items.push("RSI is elevated, so short-term momentum may be stretched.");
  if (isFiniteNumber(technicals.rsi14) && technicals.rsi14 < 30) items.push("RSI is depressed, so the asset may be oversold.");
  if (technicals.aboveSma200 === false) items.push("Price is below the 200-period average, which weakens the long-term trend.");
  if (isFiniteNumber(performance.threeMonth) && performance.threeMonth < -10) items.push("Three-month performance is sharply negative.");
  if (risk.volatility.level === "High") items.push("Volatility is high; position sizing and patience matter more.");
  if (risk.debt.level === "High") items.push("Debt is elevated compared with equity.");
  if (hasFundamentalData(fundamentals) && !items.length) items.push("No single risk flag dominates; compare valuation and trend with peers.");
  return items.slice(0, 4);
}

function buildConfidence(fundamentals, technicals) {
  let points = 0;
  if (hasFundamentalData(fundamentals)) points += 1;
  if (isFiniteNumber(technicals.sma50)) points += 1;
  if (isFiniteNumber(technicals.sma200)) points += 1;
  if (isFiniteNumber(technicals.rsi14)) points += 1;
  return points >= 3 ? "High" : points >= 2 ? "Medium" : "Low";
}

function buildWarnings(quoteResult, summaryResult, nasdaqResult, historyResult, history, fundamentals, quote) {
  const warnings = [];

  if (quoteResult.status === "rejected") {
    warnings.push("Live quote data was unavailable.");
  }
  if (!hasFundamentalData(fundamentals)) {
    const type = quote?.quoteType || quote?.type || "";
    if (type === "CURRENCY" || type === "CRYPTOCURRENCY" || type === "INDEX") {
      warnings.push("Company fundamentals do not apply to this asset type; technicals and price history are shown.");
    } else {
      warnings.push("Deep fundamentals are unavailable from the free data sources for this symbol.");
    }
  } else if (summaryResult.status === "rejected" && nasdaqResult.status === "fulfilled") {
    warnings.push("Showing available vital-sign fundamentals; deeper statement metrics are limited.");
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

function redactLocalUrl(value) {
  if (!value) return null;
  return String(value).replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@");
}

function parseScreenerSymbols(value, preset = "default") {
  const raw = String(value || "").trim();
  const symbols = raw
    ? raw.split(/[\s,;]+/)
    : (SCREENER_PRESETS[preset]?.symbols || DEFAULT_SCREENER_SYMBOLS);

  return [...new Set(symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean))]
    .slice(0, 40);
}

function rowMatchesPreset(row, preset) {
  if (preset === "stable-dividend") {
    return isFiniteNumber(row.dividendYield) && row.dividendYield > 0 && row.volatilityLevel !== "High";
  }
  if (preset === "momentum") {
    return row.rating === "Bullish" || row.aboveSma50 === true || (isFiniteNumber(row.oneMonth) && row.oneMonth > 3);
  }
  if (preset === "oversold-watch") {
    return isFiniteNumber(row.rsi14) ? row.rsi14 <= 45 : true;
  }
  if (preset === "low-volatility") {
    return row.volatilityLevel === "Low" || row.volatilityLevel === "Unknown";
  }
  return true;
}

function comparePresetRows(a, b, preset) {
  if (preset === "stable-dividend") {
    return (b.dividendYield || 0) - (a.dividendYield || 0);
  }
  if (preset === "oversold-watch") {
    return (a.rsi14 || 999) - (b.rsi14 || 999);
  }
  if (preset === "low-volatility") {
    return (a.volatility ?? 999) - (b.volatility ?? 999);
  }
  if (preset === "forex-majors") {
    return (b.oneMonth || -999) - (a.oneMonth || -999);
  }
  return b.totalScore - a.totalScore;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

async function yahooSearch(q, options = {}) {
  return yahooGet("https://query2.finance.yahoo.com/v1/finance/search", {
    q,
    quotesCount: options.quotesCount ?? 10,
    newsCount: options.newsCount ?? 0
  });
}

async function yahooQuote(symbol) {
  try {
    const data = await yahooGet("https://query2.finance.yahoo.com/v7/finance/quote", {
      symbols: symbol
    });
    return data.quoteResponse?.result?.[0] || null;
  } catch {
    const search = await yahooSearch(symbol);
    const exact = (search.quotes || []).find((item) => item.symbol?.toUpperCase() === symbol.toUpperCase());
    if (!exact) return null;
    return {
      symbol: exact.symbol,
      shortName: exact.shortname || exact.longname || exact.name || "",
      longName: exact.longname || exact.shortname || exact.name || "",
      quoteType: exact.quoteType || exact.typeDisp || "",
      fullExchangeName: exact.exchDisp || exact.exchange || "",
      exchange: exact.exchange || ""
    };
  }
}

async function yahooQuoteSummary(symbol, modules) {
  const data = await yahooGet(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
    modules: modules.join(",")
  });
  return data.quoteSummary?.result?.[0] || null;
}

async function nasdaqSummary(symbol) {
  if (!/^[A-Z]+$/.test(symbol)) return null;

  const data = await jsonGet(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary`, {
    assetclass: "stocks"
  });
  const summary = data.data?.summaryData || {};
  const primary = data.data?.primaryData || {};

  return {
    symbol: data.data?.symbol || symbol,
    companyName: data.data?.companyName || "",
    quoteType: data.data?.assetClass === "STOCKS" ? "EQUITY" : data.data?.assetClass || "",
    exchange: summary.Exchange?.value || data.data?.exchange || "",
    sector: summary.Sector?.value || "",
    industry: summary.Industry?.value || "",
    marketCap: parseNumberText(summary.MarketCap?.value),
    dividendYield: parsePercentText(summary.Yield?.value),
    annualDividend: parseNumberText(summary.AnnualizedDividend?.value),
    previousClose: parseNumberText(summary.PreviousClose?.value),
    volume: parseNumberText(summary.ShareVolume?.value || primary.volume),
    price: parseNumberText(primary.lastSalePrice),
    change: parseNumberText(primary.netChange),
    changePercent: parsePercentText(primary.percentageChange),
    marketState: data.data?.marketStatus || "",
    currency: primary.currency || ""
  };
}

async function yahooHistorical(symbol, options) {
  const data = await yahooGet(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
    period1: Math.floor(options.period1.getTime() / 1000),
    period2: Math.floor(options.period2.getTime() / 1000),
    interval: options.interval,
    events: "history",
    includeAdjustedClose: "true"
  });

  const result = data.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  return timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000),
    open: quote.open?.[index],
    high: quote.high?.[index],
    low: quote.low?.[index],
    close: quote.close?.[index],
    volume: quote.volume?.[index]
  }));
}

async function yahooGet(baseUrl, params) {
  const data = await jsonGet(baseUrl, params);
  const chartError = data.chart?.error;
  const financeError = data.finance?.error;
  const summaryError = data.quoteSummary?.error;
  const error = chartError || financeError || summaryError;
  if (error) {
    throw new Error(error.description || error.message || "Yahoo request failed");
  }
  return data;
}

async function jsonGet(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 GlobalMarketAnalyzer/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }

  return response.json();
}

function parseNumberText(value) {
  if (typeof value === "number") return toNumber(value);
  if (!value || value === "N/A" || value === "NA") return null;
  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? round(number) : null;
}

function parsePercentText(value) {
  const number = parseNumberText(value);
  return isFiniteNumber(number) ? round(number / 100) : null;
}
