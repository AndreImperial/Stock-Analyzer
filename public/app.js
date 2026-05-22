const form = document.querySelector("#analyzeForm");
const symbolInput = document.querySelector("#symbolInput");
const rangeSelect = document.querySelector("#rangeSelect");
const intervalSelect = document.querySelector("#intervalSelect");
const dashboard = document.querySelector("#dashboard");
const homeState = document.querySelector("#homeState");
const notice = document.querySelector("#notice");
const searchResults = document.querySelector("#searchResults");
const analyzeButton = document.querySelector(".primary-button");
const runScreenerButton = document.querySelector("#runScreener");
const screenerPreset = document.querySelector("#screenerPreset");
const screenerSymbols = document.querySelector("#screenerSymbols");
const screenerRating = document.querySelector("#screenerRating");
const screenerMinScore = document.querySelector("#screenerMinScore");
const screenerMeta = document.querySelector("#screenerMeta");
const screenerRows = document.querySelector("#screenerRows");
const refreshNewsButton = document.querySelector("#refreshNews");
const newsList = document.querySelector("#newsList");
const newsTitle = document.querySelector("#newsTitle");
const aiStatus = document.querySelector("#aiStatus");
const addWatchlistButton = document.querySelector("#addWatchlist");
const clearWatchlistButton = document.querySelector("#clearWatchlist");
const watchlist = document.querySelector("#watchlist");
const dataQuality = document.querySelector("#dataQuality");
const confidenceValue = document.querySelector("#confidenceValue");
const confidenceMeter = document.querySelector("#confidenceMeter");
const insightStrong = document.querySelector("#insightStrong");
const insightWeak = document.querySelector("#insightWeak");
const insightChanged = document.querySelector("#insightChanged");
const scoreExplanation = document.querySelector("#scoreExplanation");
const signalTimeline = document.querySelector("#signalTimeline");
const healthPanel = document.querySelector("#healthPanel");
const runCompareButton = document.querySelector("#runCompare");
const compareSymbols = document.querySelector("#compareSymbols");
const compareRows = document.querySelector("#compareRows");
const portfolioSymbol = document.querySelector("#portfolioSymbol");
const portfolioShares = document.querySelector("#portfolioShares");
const portfolioCost = document.querySelector("#portfolioCost");
const addHoldingButton = document.querySelector("#addHolding");
const portfolioSummary = document.querySelector("#portfolioSummary");
const portfolioRows = document.querySelector("#portfolioRows");
const presetCards = document.querySelector("#presetCards");
const presetName = document.querySelector("#presetName");
const savePresetButton = document.querySelector("#savePreset");
const newsSentiment = document.querySelector("#newsSentiment");
const defaultSymbol = document.querySelector("#defaultSymbol");
const defaultRange = document.querySelector("#defaultRange");
const densityMode = document.querySelector("#densityMode");
const saveSettingsButton = document.querySelector("#saveSettings");
const chart = document.querySelector("#priceChart");
const ctx = chart.getContext("2d");
const showSma50 = document.querySelector("#showSma50");
const showSma200 = document.querySelector("#showSma200");
const showRsi = document.querySelector("#showRsi");
const showPercent = document.querySelector("#showPercent");
const JARGON = {
  "Trailing PE": "P/E ratio based on the last 12 months of earnings.",
  "Forward PE": "P/E ratio based on expected future earnings.",
  "Market cap": "Total market value of the company.",
  "Dividend yield": "Annual dividends as a percentage of price.",
  "Debt/equity": "Debt compared with shareholder equity. Higher can mean more balance-sheet risk.",
  "SMA 20": "Simple moving average over the last 20 periods.",
  "SMA 50": "Simple moving average over the last 50 periods. Often used for medium-term trend.",
  "SMA 200": "Simple moving average over the last 200 periods. Often used for long-term trend.",
  "RSI 14": "Relative Strength Index. Above 70 can be stretched; below 30 can be oversold.",
  "ATR 14": "Average True Range. A volatility gauge showing typical recent price movement.",
  "YTD": "Year to date. Performance since the start of the current year.",
  "Beta": "How much a stock tends to move compared with the market."
};

let searchTimer = null;
let lastAnalysis = null;
let screenerData = [];
let sortState = { key: "totalScore", direction: "desc" };
const PRESET_LABELS = {
  default: "Default",
  "stable-dividend": "Dividend",
  momentum: "Momentum",
  "oversold-watch": "Oversold",
  "low-volatility": "Low vol",
  "forex-majors": "Forex",
  pse: "PSE"
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze(symbolInput.value);
});

runScreenerButton.addEventListener("click", () => {
  runScreener();
});

refreshNewsButton.addEventListener("click", () => {
  loadNews(symbolInput.value);
});

addWatchlistButton.addEventListener("click", () => {
  if (lastAnalysis) saveWatchSymbol(lastAnalysis.symbol);
});

clearWatchlistButton.addEventListener("click", () => {
  localStorage.removeItem("stockAnalyzerWatchlist");
  renderWatchlist();
});

runCompareButton.addEventListener("click", () => runCompare());

addHoldingButton.addEventListener("click", () => addHolding());

savePresetButton.addEventListener("click", () => saveCustomPreset());

saveSettingsButton.addEventListener("click", () => saveSettings());

screenerPreset.addEventListener("change", () => {
  if (!screenerSymbols.value.trim()) runScreener();
});

document.querySelectorAll("[data-focus-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.focusAction;
    if (action === "analyze") symbolInput.focus();
    if (action === "compare") {
      document.querySelector("#compareDrawer").open = true;
      compareSymbols.focus();
    }
    if (action === "screen") {
      document.querySelector(".screener-drawer").open = true;
      runScreener();
    }
  });
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    sortState = {
      key,
      direction: sortState.key === key && sortState.direction === "desc" ? "asc" : "desc"
    };
    renderScreenerRows();
  });
});

document.querySelectorAll("[data-symbol]").forEach((button) => {
  button.addEventListener("click", () => {
    symbolInput.value = button.dataset.symbol;
    hideSearch();
    analyze(button.dataset.symbol);
  });
});

symbolInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = symbolInput.value.trim();
  if (q.length < 2) {
    hideSearch();
    return;
  }
  searchTimer = setTimeout(() => searchSymbols(q), 280);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".symbol-field")) hideSearch();
});

window.addEventListener("resize", () => {
  const data = chart.dataset.history ? JSON.parse(chart.dataset.history) : [];
  if (data.length) drawChart(data);
});

[showSma50, showSma200, showRsi, showPercent].forEach((control) => {
  control.addEventListener("change", () => {
    const data = chart.dataset.history ? JSON.parse(chart.dataset.history) : [];
    if (data.length) drawChart(data);
  });
});

chart.addEventListener("mousemove", (event) => {
  const data = chart.dataset.history ? JSON.parse(chart.dataset.history) : [];
  if (!data.length) return;
  drawChart(data, event);
});

chart.addEventListener("mouseleave", () => {
  const data = chart.dataset.history ? JSON.parse(chart.dataset.history) : [];
  if (data.length) drawChart(data);
});

loadSettings();
loadAiStatus();
renderWatchlist();
renderPortfolio();
renderPresetCards();

async function searchSymbols(q) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Search failed");
    renderSearchResults(payload.results || []);
  } catch {
    hideSearch();
  }
}

function renderSearchResults(results) {
  if (!results.length) {
    hideSearch();
    return;
  }

  searchResults.innerHTML = results.map((item) => `
    <button type="button" data-pick="${escapeHtml(item.symbol)}">
      ${escapeHtml(item.symbol)} ${escapeHtml(item.shortname || "")}
      <span>${escapeHtml([item.type, item.exchange].filter(Boolean).join(" | "))}</span>
    </button>
  `).join("");

  searchResults.hidden = false;
  searchResults.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      symbolInput.value = button.dataset.pick;
      hideSearch();
      analyze(button.dataset.pick);
    });
  });
}

function hideSearch() {
  searchResults.hidden = true;
  searchResults.innerHTML = "";
}

async function analyze(symbol) {
  const cleanSymbol = String(symbol || "").trim();
  if (!cleanSymbol) return;

  setLoading(true);
  showNotice("Loading analysis...");

  const params = new URLSearchParams({
    symbol: cleanSymbol,
    range: rangeSelect.value,
    interval: intervalSelect.value
  });

  try {
    const response = await fetch(`/api/analyze?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Analysis failed");
    renderDashboard(payload);
    loadNews(payload.symbol);
    loadNewsSummary(payload.symbol);
  } catch (error) {
    dashboard.hidden = true;
    showNotice(error.message || "Unable to analyze this symbol.");
  } finally {
    setLoading(false);
  }
}

async function loadNews(symbol) {
  const cleanSymbol = String(symbol || "").trim();
  if (!cleanSymbol) return;

  newsTitle.textContent = `${cleanSymbol.toUpperCase()} headlines`;
  newsList.innerHTML = `<p class="empty-state">Loading latest news...</p>`;
  refreshNewsButton.disabled = true;

  try {
    const response = await fetch(`/api/news?symbol=${encodeURIComponent(cleanSymbol)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "News unavailable");
    renderNews(payload.news || []);
  } catch (error) {
    newsList.innerHTML = `<p class="empty-state">${escapeHtml(error.message || "News unavailable.")}</p>`;
  } finally {
    refreshNewsButton.disabled = false;
  }
}

function renderNews(items) {
  if (!items.length) {
    newsList.innerHTML = `<p class="empty-state">No recent headlines found for this symbol.</p>`;
    return;
  }

  newsList.innerHTML = items.map((item) => `
    <a class="news-item" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">
      ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="">` : ""}
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml([item.publisher, formatDateTime(item.publishedAt)].filter(Boolean).join(" | "))}</small>
      </span>
    </a>
  `).join("");
}

async function loadNewsSummary(symbol) {
  newsSentiment.textContent = "Summarizing headlines...";
  try {
    const response = await fetch(`/api/news-summary?symbol=${encodeURIComponent(symbol)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "News summary unavailable");
    newsSentiment.innerHTML = `
      <strong>${escapeHtml(payload.sentiment || "Neutral")} news tone</strong>
      <span>${escapeHtml(payload.summary || "")}</span>
    `;
  } catch (error) {
    newsSentiment.textContent = error.message || "News summary unavailable.";
  }
}

async function runCompare() {
  const symbols = compareSymbols.value.trim();
  if (!symbols) return;
  compareRows.innerHTML = `<p class="empty-state">Comparing...</p>`;
  const params = new URLSearchParams({
    symbols,
    range: rangeSelect.value,
    interval: intervalSelect.value
  });
  try {
    const response = await fetch(`/api/compare?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Compare failed");
    renderCompare(payload.rows || [], payload.failures || []);
  } catch (error) {
    compareRows.innerHTML = `<p class="empty-state">${escapeHtml(error.message || "Compare unavailable.")}</p>`;
  }
}

function renderCompare(rows, failures) {
  if (!rows.length) {
    compareRows.innerHTML = `<p class="empty-state">No comparison rows available.</p>`;
    return;
  }
  compareRows.innerHTML = rows.map((row) => `
    <article class="compare-card">
      <button class="symbol-link" type="button" data-compare-symbol="${escapeHtml(row.symbol)}">${escapeHtml(row.symbol)}</button>
      <strong>${escapeHtml(row.rating)}</strong>
      <dl>
        <div><dt>Price</dt><dd>${formatMoney(row.price, "")}</dd></div>
        <div><dt>Score</dt><dd>${formatNumber(row.totalScore)}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(row.confidence || "N/A")}</dd></div>
        <div><dt>1M</dt><dd class="${numberClass(row.oneMonth)}">${formatPercent(row.oneMonth)}</dd></div>
        <div><dt>RSI</dt><dd>${formatNumber(row.rsi14)}</dd></div>
      </dl>
    </article>
  `).join("") + (failures.length ? `<p class="empty-state">Failed: ${escapeHtml(failures.map((item) => item.symbol).join(", "))}</p>` : "");
  document.querySelectorAll("[data-compare-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      symbolInput.value = button.dataset.compareSymbol;
      analyze(button.dataset.compareSymbol);
    });
  });
}

async function runScreener() {
  setScreenerLoading(true);
  screenerMeta.textContent = "Scanning symbols...";

  const params = new URLSearchParams({
    range: rangeSelect.value,
    interval: intervalSelect.value,
    rating: screenerRating.value,
    minScore: screenerMinScore.value || "-99",
    preset: screenerPreset.value
  });

  const customSymbols = screenerSymbols.value.trim();
  if (customSymbols) {
    params.set("symbols", customSymbols);
  }

  try {
    const response = await fetch(`/api/screener?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Screener failed");
    renderScreener(payload);
  } catch (error) {
    screenerMeta.textContent = error.message || "Unable to run the screener.";
    screenerRows.innerHTML = `<tr><td colspan="9">No screener results available.</td></tr>`;
  } finally {
    setScreenerLoading(false);
  }
}

function renderScreener(data) {
  screenerData = data.rows || [];
  screenerMeta.textContent = `${data.presetLabel || "Screener"}: scanned ${data.scanned}, matched ${data.matched}. Updated ${new Date(data.asOf).toLocaleString()}.`;

  if (!screenerData.length) {
    screenerRows.innerHTML = `<tr><td colspan="9">No symbols matched these filters.</td></tr>`;
    return;
  }

  renderScreenerRows();
}

function renderScreenerRows() {
  if (!screenerData.length) return;
  const rows = [...screenerData].sort(compareRows);

  screenerRows.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <button class="symbol-link" type="button" data-screen-symbol="${escapeHtml(row.symbol)}">
          ${escapeHtml(row.symbol)}
        </button>
        <span>${escapeHtml(row.name || row.type || "")}</span>
      </td>
      <td><span class="rating-badge ${ratingClass(row.rating)}">${escapeHtml(row.rating)}</span></td>
      <td>${formatNumber(row.totalScore)}</td>
      <td>${formatMoney(row.price, "")}</td>
      <td class="${numberClass(row.oneMonth)}">${formatPercent(row.oneMonth)}</td>
      <td class="${numberClass(row.threeMonth)}">${formatPercent(row.threeMonth)}</td>
      <td>${formatNumber(row.rsi14)}</td>
      <td>${formatRiskLabel(row.volatilityLevel, row.volatility)}</td>
      <td>${escapeHtml((row.factors || []).join(" "))}</td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-screen-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      symbolInput.value = button.dataset.screenSymbol;
      analyze(button.dataset.screenSymbol);
      document.querySelector("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderDashboard(data) {
  lastAnalysis = data;
  homeState.hidden = true;
  dashboard.hidden = false;
  if (data.warnings?.length) {
    showNotice(data.warnings.join(" "));
  } else {
    hideNotice();
  }

  const quote = data.quote || {};
  document.querySelector("#marketStatus").textContent = quote.marketState || "Market data";
  document.querySelector("#rating").textContent = data.analysis.rating;
  document.querySelector("#scoreRing").textContent = formatNumber(data.analysis.totalScore);
  document.querySelector("#fundScore").textContent = formatNumber(data.analysis.fundamentalScore);
  document.querySelector("#techScore").textContent = formatNumber(data.analysis.technicalScore);
  document.querySelector("#caveat").textContent = data.analysis.caveat;
  document.querySelector("#assetType").textContent = [quote.type, quote.exchange].filter(Boolean).join(" | ") || "Quote";
  document.querySelector("#assetName").textContent = quote.name ? `${data.symbol} - ${quote.name}` : data.symbol;
  document.querySelector("#price").textContent = formatMoney(quote.price, quote.currency);
  document.querySelector("#change").textContent = formatChange(quote.change, quote.changePercent);
  document.querySelector("#change").className = quote.changePercent > 0 ? "positive" : quote.changePercent < 0 ? "negative" : "";
  document.querySelector("#chartTitle").textContent = `${data.symbol} close price`;
  document.querySelector("#asOf").textContent = `As of ${new Date(data.asOf).toLocaleString()}`;
  renderBottomLine(data);
  renderVitalSigns(data);
  renderInsights(data);
  renderConfidence(data.confidence);
  renderDataQuality(data.dataQuality || []);
  renderTimeline(data.technicalTimeline || []);
  renderHealth(data.fundamentalHealth || []);
  renderFactors("#scoreExplanation", data.scoreExplanation || []);

  renderDefinitionList("#quoteStats", [
    ["Previous close", formatMoney(quote.previousClose, quote.currency)],
    ["Day range", formatRange(quote.dayLow, quote.dayHigh, quote.currency)],
    ["Volume", formatCompact(quote.volume)],
    ["Currency", quote.currency || "N/A"]
  ]);

  renderDefinitionList("#fundamentals", [
    ["Market cap", formatCompact(data.fundamentals.marketCap)],
    ["Trailing PE", formatNumber(data.fundamentals.trailingPE)],
    ["Forward PE", formatNumber(data.fundamentals.forwardPE)],
    ["EPS", formatNumber(data.fundamentals.eps)],
    ["Revenue growth", formatPercentRatio(data.fundamentals.revenueGrowth)],
    ["Earnings growth", formatPercentRatio(data.fundamentals.earningsGrowth)],
    ["Dividend yield", formatPercentRatio(data.fundamentals.dividendYield)],
    ["Beta", formatNumber(data.fundamentals.beta)],
    ["Profit margin", formatPercentRatio(data.fundamentals.profitMargin)],
    ["Debt/equity", formatNumber(data.fundamentals.debtToEquity)],
    ["Sector", data.fundamentals.sector || "N/A"],
    ["Industry", data.fundamentals.industry || "N/A"]
  ]);

  renderDefinitionList("#technicals", [
    ["Close", formatMoney(data.technicals.close, quote.currency)],
    ["SMA 20", formatNumber(data.technicals.sma20)],
    ["SMA 50", formatNumber(data.technicals.sma50)],
    ["SMA 200", formatNumber(data.technicals.sma200)],
    ["EMA 20", formatNumber(data.technicals.ema20)],
    ["RSI 14", formatNumber(data.technicals.rsi14)],
    ["MACD", formatNumber(data.technicals.macd.macd)],
    ["MACD signal", formatNumber(data.technicals.macd.signal)],
    ["ATR 14", formatNumber(data.technicals.atr14)],
    ["Bollinger range", `${formatNumber(data.technicals.bollinger.lower)} - ${formatNumber(data.technicals.bollinger.upper)}`]
  ]);

  renderDefinitionList("#performance", [
    ["1D", formatPercent(data.performance.oneDay)],
    ["1W", formatPercent(data.performance.oneWeek)],
    ["1M", formatPercent(data.performance.oneMonth)],
    ["3M", formatPercent(data.performance.threeMonth)],
    ["YTD", formatPercent(data.performance.ytd)]
  ]);

  renderFactors("#fundFactors", data.analysis.fundamentalFactors);
  renderFactors("#techFactors", data.analysis.technicalFactors);

  chart.dataset.history = JSON.stringify(data.history || []);
  drawChart(data.history || []);
  renderPortfolio();
}

async function loadAiStatus() {
  try {
    const response = await fetch("/api/ai/status");
    const payload = await response.json();
    aiStatus.textContent = payload.label || "Rules fallback";
    aiStatus.className = `status-pill ai-${payload.status || "fallback"}`;
  } catch {
    aiStatus.textContent = "Rules fallback";
    aiStatus.className = "status-pill ai-fallback";
  }
}

function renderBottomLine(data) {
  const bottomLine = data.bottomLine || {};
  const risk = data.risk || {};

  document.querySelector("#bottomLineHeadline").textContent = bottomLine.headline || `${data.symbol} summary`;
  document.querySelector("#bottomLineText").textContent = bottomLine.summary || data.analysis.caveat;
  document.querySelector("#missingNotes").textContent = (bottomLine.missingData || []).join(" ");
  document.querySelector("#summarySource").textContent = bottomLine.source === "Ollama"
    ? `${bottomLine.source} summary`
    : "Rules summary";
  document.querySelector("#watchItems").innerHTML = (bottomLine.watch || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  renderRiskMeter("volatility", risk.volatility);
  renderRiskMeter("debt", risk.debt);
}

function renderInsights(data) {
  renderFactors("#insightStrong", data.insights?.strong?.length ? data.insights.strong : ["No clear strength signal yet."]);
  renderFactors("#insightWeak", data.insights?.weak?.length ? data.insights.weak : ["No major weakness signal dominates."]);
  renderFactors("#insightChanged", data.insights?.changed?.length ? data.insights.changed : ["Not enough recent change data."]);
}

function renderConfidence(confidence) {
  const value = confidence || "Low";
  confidenceValue.textContent = value;
  confidenceMeter.className = `meter-${value.toLowerCase()}`;
}

function renderDataQuality(items) {
  dataQuality.innerHTML = (items || []).map((item) => `
    <span class="quality-badge quality-${escapeHtml(item.level || "info")}">${escapeHtml(item.label)}</span>
  `).join("");
}

function renderTimeline(items) {
  signalTimeline.innerHTML = items.length
    ? items.map((item) => `<div class="timeline-item tone-${escapeHtml(item.tone)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")
    : `<p class="empty-state">Not enough technical signals yet.</p>`;
}

function renderHealth(items) {
  healthPanel.innerHTML = items.length
    ? items.map((item) => `<div class="health-item tone-${escapeHtml(item.tone)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.status)}</strong></div>`).join("")
    : `<p class="empty-state">Fundamental health is unavailable.</p>`;
}

function renderVitalSigns(data) {
  document.querySelector("#vitalPe").textContent = formatNumber(data.fundamentals.trailingPE || data.fundamentals.forwardPE);
  document.querySelector("#vitalMarketCap").textContent = formatCompact(data.fundamentals.marketCap);
  document.querySelector("#vitalDividend").textContent = formatPercentRatio(data.fundamentals.dividendYield);
  document.querySelector("#vitalGrowth").textContent = formatPercent(data.performance.oneYear ?? data.performance.ytd ?? data.performance.threeMonth ?? data.performance.oneMonth);
}

function renderRiskMeter(kind, risk) {
  const level = risk?.level || "Unknown";
  const label = risk?.label || "Not available";
  const className = `meter-${level.toLowerCase()}`;

  document.querySelector(`#${kind}Risk`).textContent = level;
  document.querySelector(`#${kind}Label`).textContent = label;
  document.querySelector(`#${kind}Meter`).className = className;
}

function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem("stockAnalyzerWatchlist") || "[]");
  } catch {
    return [];
  }
}

function saveWatchSymbol(symbol) {
  const clean = String(symbol || "").trim().toUpperCase();
  if (!clean) return;
  const symbols = [clean, ...getWatchlist().filter((item) => item !== clean)].slice(0, 30);
  localStorage.setItem("stockAnalyzerWatchlist", JSON.stringify(symbols));
  renderWatchlist();
}

function removeWatchSymbol(symbol) {
  const symbols = getWatchlist().filter((item) => item !== symbol);
  localStorage.setItem("stockAnalyzerWatchlist", JSON.stringify(symbols));
  renderWatchlist();
}

function renderWatchlist() {
  const symbols = getWatchlist();
  if (!symbols.length) {
    watchlist.innerHTML = `<p class="empty-state">Save symbols you want to revisit. Stored only in this browser.</p>`;
    return;
  }

  watchlist.innerHTML = symbols.map((symbol) => `
    <span class="watch-chip">
      <button type="button" data-watch-symbol="${escapeHtml(symbol)}">${escapeHtml(symbol)}</button>
      <button type="button" aria-label="Remove ${escapeHtml(symbol)}" data-remove-watch="${escapeHtml(symbol)}">x</button>
    </span>
  `).join("");

  document.querySelectorAll("[data-watch-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      symbolInput.value = button.dataset.watchSymbol;
      analyze(button.dataset.watchSymbol);
    });
  });

  document.querySelectorAll("[data-remove-watch]").forEach((button) => {
    button.addEventListener("click", () => removeWatchSymbol(button.dataset.removeWatch));
  });
}

function getHoldings() {
  try {
    return JSON.parse(localStorage.getItem("stockAnalyzerPortfolio") || "[]");
  } catch {
    return [];
  }
}

function saveHoldings(holdings) {
  localStorage.setItem("stockAnalyzerPortfolio", JSON.stringify(holdings));
}

function addHolding() {
  const symbol = portfolioSymbol.value.trim().toUpperCase();
  const shares = Number(portfolioShares.value);
  const cost = Number(portfolioCost.value);
  if (!symbol || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost < 0) return;
  const holdings = [{ symbol, shares, cost }, ...getHoldings()].slice(0, 25);
  saveHoldings(holdings);
  portfolioSymbol.value = "";
  portfolioShares.value = "";
  portfolioCost.value = "";
  renderPortfolio();
}

function removeHolding(index) {
  const holdings = getHoldings();
  holdings.splice(index, 1);
  saveHoldings(holdings);
  renderPortfolio();
}

function renderPortfolio() {
  const holdings = getHoldings();
  if (!holdings.length) {
    portfolioSummary.textContent = "Sandbox is local-only. Add fake holdings to estimate allocation and P/L.";
    portfolioRows.innerHTML = `<tr><td colspan="6">No fake holdings yet.</td></tr>`;
    return;
  }

  const enriched = holdings.map((holding) => {
    const livePrice = lastAnalysis?.symbol === holding.symbol ? lastAnalysis.quote.price : null;
    const price = Number.isFinite(livePrice) ? livePrice : holding.cost;
    const value = holding.shares * price;
    const costBasis = holding.shares * holding.cost;
    return { ...holding, price, value, costBasis, pnl: value - costBasis };
  });
  const totalValue = enriched.reduce((sum, item) => sum + item.value, 0);
  const totalPnl = enriched.reduce((sum, item) => sum + item.pnl, 0);
  portfolioSummary.textContent = `Estimated value ${formatMoney(totalValue, "")}. Estimated P/L ${formatSigned(totalPnl)}. Prices use the currently analyzed symbol when available.`;
  portfolioRows.innerHTML = enriched.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.symbol)}</td>
      <td>${formatNumber(item.shares)}</td>
      <td>${formatMoney(item.cost, "")}</td>
      <td>${formatMoney(item.value, "")}</td>
      <td class="${numberClass(item.pnl)}">${formatSigned(item.pnl)}</td>
      <td><button class="symbol-link" type="button" data-remove-holding="${index}">Remove</button></td>
    </tr>
  `).join("");
  document.querySelectorAll("[data-remove-holding]").forEach((button) => {
    button.addEventListener("click", () => removeHolding(Number(button.dataset.removeHolding)));
  });
}

function getCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem("stockAnalyzerPresets") || "[]");
  } catch {
    return [];
  }
}

function saveCustomPreset() {
  const name = presetName.value.trim();
  const symbols = screenerSymbols.value.trim();
  if (!name || !symbols) return;
  const presets = [{ name, symbols }, ...getCustomPresets().filter((item) => item.name !== name)].slice(0, 12);
  localStorage.setItem("stockAnalyzerPresets", JSON.stringify(presets));
  presetName.value = "";
  renderPresetCards();
}

function renderPresetCards() {
  const builtIns = Object.entries(PRESET_LABELS).map(([value, label]) => ({ label, value, builtIn: true }));
  const custom = getCustomPresets().map((item) => ({ label: item.name, symbols: item.symbols, builtIn: false }));
  presetCards.innerHTML = [...builtIns, ...custom].map((preset) => `
    <button type="button" data-preset-card="${escapeHtml(preset.value || "")}" data-preset-symbols="${escapeHtml(preset.symbols || "")}">
      ${escapeHtml(preset.label)}
    </button>
  `).join("");
  document.querySelectorAll("[data-preset-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const customSymbols = button.dataset.presetSymbols;
      if (customSymbols) {
        screenerSymbols.value = customSymbols;
      } else {
        screenerSymbols.value = "";
        screenerPreset.value = button.dataset.presetCard;
      }
      runScreener();
    });
  });
}

function loadSettings() {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem("stockAnalyzerSettings") || "{}");
  } catch {
    settings = {};
  }
  symbolInput.value = settings.defaultSymbol || symbolInput.value;
  defaultSymbol.value = symbolInput.value;
  if (settings.defaultRange) rangeSelect.value = settings.defaultRange;
  defaultRange.value = rangeSelect.value;
  densityMode.value = settings.density || "comfortable";
  document.body.dataset.density = densityMode.value;
}

function saveSettings() {
  const settings = {
    defaultSymbol: defaultSymbol.value.trim().toUpperCase() || "AAPL",
    defaultRange: defaultRange.value,
    density: densityMode.value
  };
  localStorage.setItem("stockAnalyzerSettings", JSON.stringify(settings));
  symbolInput.value = settings.defaultSymbol;
  rangeSelect.value = settings.defaultRange;
  document.body.dataset.density = settings.density;
}

function renderDefinitionList(selector, rows) {
  document.querySelector(selector).innerHTML = rows.map(([label, value]) => `
    <div>
      <dt>${labelWithTooltip(label)}</dt>
      <dd>${escapeHtml(value ?? "N/A")}</dd>
    </div>
  `).join("");
}

function labelWithTooltip(label) {
  const tip = JARGON[label];
  if (!tip) return escapeHtml(label);
  return `${escapeHtml(label)} <span class="term" tabindex="0" data-tip="${escapeHtml(tip)}">?</span>`;
}

function renderFactors(selector, items) {
  document.querySelector(selector).innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function drawChart(history, hoverEvent = null) {
  const ratio = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();
  chart.width = Math.max(320, Math.floor(rect.width * ratio));
  chart.height = Math.max(260, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  if (!history.length) {
    ctx.fillStyle = "#677281";
    ctx.font = "16px system-ui";
    ctx.fillText("No chart data available", 24, 42);
    return;
  }

  const padding = { top: 18, right: 18, bottom: 34, left: 58 };
  const baseClose = history.find((point) => Number.isFinite(point.close))?.close || 1;
  const asChartValue = (value) => showPercent.checked && Number.isFinite(value)
    ? ((value - baseClose) / baseClose) * 100
    : value;
  const closes = history.map((point) => asChartValue(point.close)).filter((value) => Number.isFinite(value));
  if (!closes.length) {
    ctx.fillStyle = "#677281";
    ctx.font = "16px system-ui";
    ctx.fillText("No usable close prices available", 24, 42);
    return;
  }
  const sma50 = movingAverageSeries(history, 50).map(asChartValue);
  const sma200 = movingAverageSeries(history, 200).map(asChartValue);
  const rsi14 = rsiSeries(history, 14);
  const visibleValues = [
    ...closes,
    ...(showSma50.checked ? sma50.filter(Number.isFinite) : []),
    ...(showSma200.checked ? sma200.filter(Number.isFinite) : [])
  ];
  const min = Math.min(...visibleValues);
  const max = Math.max(...visibleValues);
  const span = max - min || Math.max(1, max * 0.02);
  const plotW = width - padding.left - padding.right;
  const fullPlotH = height - padding.top - padding.bottom;
  const rsiEnabled = showRsi.checked;
  const rsiGap = rsiEnabled ? 24 : 0;
  const rsiH = rsiEnabled ? Math.max(82, fullPlotH * 0.24) : 0;
  const plotH = fullPlotH - rsiH - rsiGap;

  ctx.strokeStyle = "#dce1e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotH / 4) * i;
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#677281";
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = max - (span / 4) * i;
    const y = padding.top + (plotH / 4) * i + 4;
    ctx.fillText(showPercent.checked ? `${formatNumber(value)}%` : formatNumber(value), padding.left - 8, y);
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
  gradient.addColorStop(0, "rgba(15, 118, 110, 0.18)");
  gradient.addColorStop(1, "rgba(15, 118, 110, 0)");
  const closeValues = history.map((point) => asChartValue(point.close));
  fillArea(closeValues, gradient, (value) => padding.top + plotH - ((value - min) / span) * plotH);
  drawLine(closeValues, "#0f766e", 2.5, (value) => padding.top + plotH - ((value - min) / span) * plotH);

  if (showSma50.checked) {
    drawLine(sma50, "#a15c07", 1.8, (value) => padding.top + plotH - ((value - min) / span) * plotH);
  }

  if (showSma200.checked) {
    drawLine(sma200, "#4f46e5", 1.8, (value) => padding.top + plotH - ((value - min) / span) * plotH);
  }

  if (rsiEnabled) {
    const rsiTop = padding.top + plotH + rsiGap;
    ctx.strokeStyle = "#dce1e7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    [30, 70].forEach((level) => {
      const y = rsiTop + rsiH - (level / 100) * rsiH;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
    });
    ctx.stroke();
    drawLine(rsi14, "#7c3aed", 1.7, (value) => rsiTop + rsiH - (value / 100) * rsiH);
    ctx.fillStyle = "#677281";
    ctx.textAlign = "left";
    ctx.fillText("RSI", padding.left, rsiTop + 12);
  }

  ctx.fillStyle = "#677281";
  ctx.textAlign = "left";
  ctx.fillText(showPercent.checked ? "% change" : "Close", padding.left, 14);
  if (showSma50.checked) ctx.fillText("50 SMA", padding.left + 54, 14);
  if (showSma200.checked) ctx.fillText("200 SMA", padding.left + 112, 14);
  ctx.fillText(history[0].date, padding.left, height - 12);
  ctx.textAlign = "right";
  ctx.fillText(history[history.length - 1].date, width - padding.right, height - 12);

  if (hoverEvent) {
    const bounds = chart.getBoundingClientRect();
    const mouseX = hoverEvent.clientX - bounds.left;
    const index = Math.max(0, Math.min(history.length - 1, Math.round(((mouseX - padding.left) / plotW) * (history.length - 1))));
    const point = history[index];
    const x = padding.left + (plotW * index) / Math.max(1, history.length - 1);
    const yValue = asChartValue(point.close);
    const y = padding.top + plotH - ((yValue - min) / span) * plotH;
    ctx.strokeStyle = "rgba(17, 24, 39, 0.34)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const label = `${point.date}  ${showPercent.checked ? formatPercent(yValue) : formatNumber(point.close)}`;
    ctx.font = "12px system-ui";
    const labelWidth = ctx.measureText(label).width + 16;
    const boxX = Math.min(width - padding.right - labelWidth, Math.max(padding.left, x + 10));
    const boxY = Math.max(padding.top + 4, y - 34);
    ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
    ctx.fillRect(boxX, boxY, labelWidth, 26);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(label, boxX + 8, boxY + 17);
  }

  function drawLine(values, color, lineWidth, mapY) {
    ctx.beginPath();
    let started = false;
    values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const x = padding.left + (plotW * index) / Math.max(1, history.length - 1);
      const y = mapY(value);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function fillArea(values, fillStyle, mapY) {
    ctx.beginPath();
    let firstX = null;
    let lastX = null;
    values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const x = padding.left + (plotW * index) / Math.max(1, history.length - 1);
      const y = mapY(value);
      if (firstX === null) {
        firstX = x;
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      lastX = x;
    });
    if (firstX === null || lastX === null) return;
    ctx.lineTo(lastX, padding.top + plotH);
    ctx.lineTo(firstX, padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
}

function movingAverageSeries(history, period) {
  return history.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = history.slice(index + 1 - period, index + 1).map((point) => point.close);
    if (slice.some((value) => !Number.isFinite(value))) return null;
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function rsiSeries(history, period) {
  const closes = history.map((point) => point.close);
  return closes.map((_, index) => {
    if (index < period) return null;
    let gains = 0;
    let losses = 0;
    for (let i = index - period + 1; i <= index; i += 1) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  });
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "Analyzing" : "Analyze";
}

function setScreenerLoading(isLoading) {
  runScreenerButton.disabled = isLoading;
  runScreenerButton.textContent = isLoading ? "Scanning" : "Run Screener";
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function hideNotice() {
  notice.hidden = true;
  notice.textContent = "";
}

function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return "N/A";
  const suffix = currency ? ` ${currency}` : "";
  return `${formatNumber(value)}${suffix}`;
}

function formatChange(change, pct) {
  if (!Number.isFinite(change) && !Number.isFinite(pct)) return "N/A";
  return `${formatSigned(change)} (${formatPercent(pct)})`;
}

function formatRange(low, high, currency) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return "N/A";
  return `${formatMoney(low, currency)} - ${formatMoney(high, currency)}`;
}

function formatCompact(value) {
  if (!Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}%`;
}

function formatPercentRatio(value) {
  if (!Number.isFinite(value)) return "N/A";
  return formatPercent(value * 100);
}

function formatSigned(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function numberClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "";
}

function ratingClass(rating) {
  if (rating === "Bullish") return "rating-bullish";
  if (rating === "Bearish") return "rating-bearish";
  return "rating-neutral";
}

function compareRows(a, b) {
  const direction = sortState.direction === "asc" ? 1 : -1;
  const aValue = a[sortState.key];
  const bValue = b[sortState.key];
  if (typeof aValue === "string" || typeof bValue === "string") {
    return direction * String(aValue || "").localeCompare(String(bValue || ""));
  }
  return direction * ((aValue ?? -999999) - (bValue ?? -999999));
}

function formatRiskLabel(level, value) {
  const riskLevel = level || "Unknown";
  const suffix = Number.isFinite(value) ? ` (${formatNumber(value)}%)` : "";
  return `${riskLevel}${suffix}`;
}

function formatTrend(row) {
  const parts = [];
  if (row.aboveSma50 === true) parts.push(">50");
  if (row.aboveSma50 === false) parts.push("<50");
  if (row.aboveSma200 === true) parts.push(">200");
  if (row.aboveSma200 === false) parts.push("<200");
  return parts.length ? parts.join(" ") : "N/A";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
