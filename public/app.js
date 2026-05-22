const form = document.querySelector("#analyzeForm");
const symbolInput = document.querySelector("#symbolInput");
const rangeSelect = document.querySelector("#rangeSelect");
const intervalSelect = document.querySelector("#intervalSelect");
const dashboard = document.querySelector("#dashboard");
const notice = document.querySelector("#notice");
const searchResults = document.querySelector("#searchResults");
const analyzeButton = document.querySelector(".primary-button");
const runScreenerButton = document.querySelector("#runScreener");
const screenerSymbols = document.querySelector("#screenerSymbols");
const screenerRating = document.querySelector("#screenerRating");
const screenerMinScore = document.querySelector("#screenerMinScore");
const screenerMeta = document.querySelector("#screenerMeta");
const screenerRows = document.querySelector("#screenerRows");
const refreshNewsButton = document.querySelector("#refreshNews");
const newsList = document.querySelector("#newsList");
const newsTitle = document.querySelector("#newsTitle");
const chart = document.querySelector("#priceChart");
const ctx = chart.getContext("2d");

let searchTimer = null;

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

analyze(symbolInput.value);
runScreener();

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

async function runScreener() {
  setScreenerLoading(true);
  screenerMeta.textContent = "Scanning symbols...";

  const params = new URLSearchParams({
    range: rangeSelect.value,
    interval: intervalSelect.value,
    rating: screenerRating.value,
    minScore: screenerMinScore.value || "-99"
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
  screenerMeta.textContent = `Scanned ${data.scanned} symbols. Matched ${data.matched}. Updated ${new Date(data.asOf).toLocaleString()}.`;

  if (!data.rows?.length) {
    screenerRows.innerHTML = `<tr><td colspan="9">No symbols matched these filters.</td></tr>`;
    return;
  }

  screenerRows.innerHTML = data.rows.map((row) => `
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
      <td>${formatTrend(row)}</td>
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
}

function renderBottomLine(data) {
  const bottomLine = data.bottomLine || {};
  const risk = data.risk || {};

  document.querySelector("#bottomLineHeadline").textContent = bottomLine.headline || `${data.symbol} summary`;
  document.querySelector("#bottomLineText").textContent = bottomLine.summary || data.analysis.caveat;
  document.querySelector("#summarySource").textContent = bottomLine.source === "OpenAI" ? "AI summary" : "Rules summary";
  document.querySelector("#watchItems").innerHTML = (bottomLine.watch || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  renderRiskMeter("volatility", risk.volatility);
  renderRiskMeter("debt", risk.debt);
}

function renderVitalSigns(data) {
  document.querySelector("#vitalPe").textContent = formatNumber(data.fundamentals.trailingPE || data.fundamentals.forwardPE);
  document.querySelector("#vitalMarketCap").textContent = formatCompact(data.fundamentals.marketCap);
  document.querySelector("#vitalDividend").textContent = formatPercentRatio(data.fundamentals.dividendYield);
  document.querySelector("#vitalGrowth").textContent = formatPercent(data.performance.ytd ?? data.performance.threeMonth ?? data.performance.oneMonth);
}

function renderRiskMeter(kind, risk) {
  const level = risk?.level || "Unknown";
  const label = risk?.label || "Not available";
  const className = `meter-${level.toLowerCase()}`;

  document.querySelector(`#${kind}Risk`).textContent = level;
  document.querySelector(`#${kind}Label`).textContent = label;
  document.querySelector(`#${kind}Meter`).className = className;
}

function renderDefinitionList(selector, rows) {
  document.querySelector(selector).innerHTML = rows.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value ?? "N/A")}</dd>
    </div>
  `).join("");
}

function renderFactors(selector, items) {
  document.querySelector(selector).innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function drawChart(history) {
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
  const closes = history.map((point) => point.close).filter((value) => Number.isFinite(value));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || Math.max(1, max * 0.02);
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

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
    ctx.fillText(formatNumber(value), padding.left - 8, y);
  }

  ctx.beginPath();
  history.forEach((point, index) => {
    const x = padding.left + (plotW * index) / Math.max(1, history.length - 1);
    const y = padding.top + plotH - ((point.close - min) / span) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(15, 118, 110, 0.18)");
  gradient.addColorStop(1, "rgba(15, 118, 110, 0)");
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.fillStyle = "#677281";
  ctx.textAlign = "left";
  ctx.fillText(history[0].date, padding.left, height - 12);
  ctx.textAlign = "right";
  ctx.fillText(history[history.length - 1].date, width - padding.right, height - 12);
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
