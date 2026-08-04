import {
  state,
  formatMoney,
  lowStockProducts,
  salesOnDay,
  salesInWeek,
  salesInMonth,
  salesBetween,
  totalRevenue,
  totalProfit,
  dayTarget,
  weeklyTarget,
  monthlyTarget,
  categoriesList,
  itemCategory,
  filterSales
} from "../store.js";
import { navigate } from "../router.js";

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}
function toInputMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

let chartFilters = { range: 30, category: "All", payment: "All" };

export async function renderDashboard(root) {
  draw(root, { day: toInputDate(new Date()), week: toInputDate(new Date()), month: toInputMonth(new Date()) });
}

function progressBar(actual, target) {
  if (target <= 0) {
    return `<p class="kpi-progress-label">No target set — add one in Settings.</p>`;
  }
  const pct = Math.min((actual / target) * 100, 100);
  const over = actual >= target;
  return `
    <div class="kpi-progress-track"><div class="kpi-progress-fill ${over ? "kpi-progress-fill--over" : ""}" style="width:${pct}%"></div></div>
    <div class="kpi-progress-label">${over ? "Target reached — " : ""}${Math.round((actual / target) * 100)}% of ${formatMoney(target)}</div>
  `;
}

function draw(root, filters) {
  const dayDate = new Date(filters.day + "T00:00:00");
  const weekDate = new Date(filters.week + "T00:00:00");
  const [y, m] = filters.month.split("-").map(Number);
  const monthDate = new Date(y, m - 1, 1);

  const daySales = salesOnDay(dayDate);
  const weekSales = salesInWeek(weekDate);
  const monthSales = salesInMonth(monthDate);

  const dayActual = totalRevenue(daySales);
  const weekActual = totalRevenue(weekSales);
  const monthActual = totalRevenue(monthSales);
  const dayProfit = totalProfit(daySales);
  const monthProfit = totalProfit(monthSales);

  const lowStock = lowStockProducts();

  root.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <button class="btn btn-primary" id="go-new-sale">+ New sale</button>
    </div>

    <div class="panel">
      <div class="filter-row">
        <label class="field field-inline"><span>Day KPI for</span><input class="input" type="date" id="day-filter" value="${filters.day}" /></label>
        <label class="field field-inline"><span>Week KPI for</span><input class="input" type="date" id="week-filter" value="${filters.week}" /></label>
        <label class="field field-inline"><span>Month KPI for</span><input class="input" type="month" id="month-filter" value="${filters.month}" /></label>
      </div>
    </div>

    <div class="stat-grid stat-grid--3">
      <div class="stat-card">
        <span class="stat-label">Day target vs actual</span>
        <span class="stat-value mono">${formatMoney(dayActual)}</span>
        ${progressBar(dayActual, dayTarget())}
      </div>
      <div class="stat-card">
        <span class="stat-label">Weekly target vs actual</span>
        <span class="stat-value mono">${formatMoney(weekActual)}</span>
        ${progressBar(weekActual, weeklyTarget())}
      </div>
      <div class="stat-card">
        <span class="stat-label">Monthly target vs actual</span>
        <span class="stat-value mono">${formatMoney(monthActual)}</span>
        ${progressBar(monthActual, monthlyTarget())}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Day profit</span>
        <span class="stat-value mono">${formatMoney(dayProfit)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Monthly profit</span>
        <span class="stat-value mono">${formatMoney(monthProfit)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Products in catalog</span>
        <span class="stat-value mono">${state.products.filter(p => p.Active).length}</span>
      </div>
      <div class="stat-card ${lowStock.length ? "stat-card--warn" : ""}">
        <span class="stat-label">Low stock alerts</span>
        <span class="stat-value mono">${lowStock.length}</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>📊 Trends</h2></div>
      <div class="chip-row" id="range-slicer">
        ${[7, 30, 90].map(n => `<button class="chip ${chartFilters.range === n ? "chip--active" : ""}" data-range="${n}">${n} days</button>`).join("")}
      </div>
      <div class="filter-row">
        <label class="field field-inline">
          <span>Category</span>
          <select class="input" id="category-slicer">
            <option value="All" ${chartFilters.category === "All" ? "selected" : ""}>All</option>
            ${categoriesList().map(c => `<option value="${c}" ${chartFilters.category === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </label>
        <label class="field field-inline">
          <span>Payment</span>
          <select class="input" id="payment-slicer">
            ${["All", "Cash", "Card", "Bank Transfer", "Other"].map(p => `<option value="${p}" ${chartFilters.payment === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="chart-grid">
        <div class="chart-box">
          <h3 class="chart-title">Revenue by day</h3>
          <canvas id="trend-chart" height="200"></canvas>
        </div>
        <div class="chart-box">
          <h3 class="chart-title">Revenue by category</h3>
          <canvas id="category-chart" height="200"></canvas>
          <div class="chart-legend" id="category-legend"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Low stock</h2>
        <a href="#/inventory" class="link">Manage inventory →</a>
      </div>
      ${
        lowStock.length === 0
          ? `<p class="empty">Everything is stocked above its alert level.</p>`
          : `<table class="table">
              <thead><tr><th>SKU</th><th>Product</th><th>Stock left</th><th>Alert at</th></tr></thead>
              <tbody>
                ${lowStock
                  .map(
                    p => `<tr>
                      <td class="mono">${p.SKU}</td>
                      <td>${p.Name}</td>
                      <td class="mono ${p.Stock === 0 ? "text-danger" : "text-warn"}">${p.Stock}</td>
                      <td class="mono">${p.LowStockAt}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
      }
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Recent sales</h2>
        <a href="#/sales" class="link">Full history →</a>
      </div>
      ${
        state.sales.length === 0
          ? `<p class="empty">No sales recorded yet. Ring up your first sale to see it here.</p>`
          : `<table class="table">
              <thead><tr><th>Time</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th></tr></thead>
              <tbody>
                ${state.sales
                  .slice(0, 8)
                  .map(
                    s => `<tr>
                      <td class="mono">${new Date(s.DateTime).toLocaleString()}</td>
                      <td>${s.CustomerName || "Walk-in"}</td>
                      <td>${s.Items.reduce((n, i) => n + Number(i.qty), 0)}</td>
                      <td class="mono">${formatMoney(s.Total)}</td>
                      <td>${s.PaymentMethod}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
      }
    </div>
  `;

  root.querySelector("#go-new-sale").addEventListener("click", () => navigate("pos"));
  root.querySelector("#day-filter").addEventListener("change", e => draw(root, { ...filters, day: e.target.value }));
  root.querySelector("#week-filter").addEventListener("change", e => draw(root, { ...filters, week: e.target.value }));
  root.querySelector("#month-filter").addEventListener("change", e => draw(root, { ...filters, month: e.target.value }));

  root.querySelectorAll("#range-slicer .chip").forEach(chip =>
    chip.addEventListener("click", () => {
      chartFilters.range = Number(chip.dataset.range);
      draw(root, filters);
    })
  );
  root.querySelector("#category-slicer").addEventListener("change", e => {
    chartFilters.category = e.target.value;
    draw(root, filters);
  });
  root.querySelector("#payment-slicer").addEventListener("change", e => {
    chartFilters.payment = e.target.value;
    draw(root, filters);
  });

  drawCharts(root);
}

const PALETTE = ["#1FB6E8", "#0D8FBF", "#DE9A2E", "#D8503B", "#7C8896", "#6FCF97", "#9B59B6", "#F2994A"];

function drawCharts(root) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (chartFilters.range - 1));
  start.setHours(0, 0, 0, 0);

  const rangeSales = filterSales(salesBetween(start, end), { payment: chartFilters.payment });

  drawTrendChart(root.querySelector("#trend-chart"), rangeSales, start, end);
  drawCategoryChart(root.querySelector("#category-chart"), root.querySelector("#category-legend"), rangeSales);
}

function itemsRevenue(items, categoryFilter) {
  return (items || [])
    .filter(i => categoryFilter === "All" || itemCategory(i) === categoryFilter)
    .reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
}

function drawTrendChart(canvas, sales, start, end) {
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({ key: toInputDate(cursor), label: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }), total: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const map = new Map(days.map(d => [d.key, d]));
  sales.forEach(s => {
    const key = toInputDate(new Date(s.DateTime));
    if (map.has(key)) map.get(key).total += itemsRevenue(s.Items, chartFilters.category);
  });

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = 200;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const max = Math.max(...days.map(d => d.total), 1);
  const paddingBottom = 26;
  const chartHeight = height - paddingBottom - 8;
  const barGap = days.length > 40 ? 1 : 4;
  const barWidth = Math.max((width - barGap * (days.length - 1)) / days.length, 2);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1FB6E8";
  const labelEvery = Math.ceil(days.length / 10);

  days.forEach((d, i) => {
    const x = i * (barWidth + barGap);
    const barHeight = (d.total / max) * chartHeight;
    const y = chartHeight - barHeight + 8;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, barWidth, barHeight);

    if (i % labelEvery === 0) {
      ctx.save();
      ctx.translate(x + barWidth / 2, height - 6);
      ctx.fillStyle = "#64707B";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(d.label, 0, 0);
      ctx.restore();
    }
  });
}

function drawCategoryChart(canvas, legendEl, sales) {
  const totals = new Map();
  sales.forEach(s => {
    (s.Items || []).forEach(i => {
      const cat = itemCategory(i);
      totals.set(cat, (totals.get(cat) || 0) + Number(i.price) * Number(i.qty));
    });
  });
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const grandTotal = entries.reduce((sum, [, v]) => sum + v, 0);

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = 200;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (grandTotal === 0) {
    ctx.fillStyle = "#64707B";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No sales in this range.", width / 2, height / 2);
    legendEl.innerHTML = "";
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) / 2 - 6;
  const innerR = outerR * 0.6;
  let angle = -Math.PI / 2;

  entries.forEach(([, value], i) => {
    const slice = (value / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    angle += slice;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  legendEl.innerHTML = entries
    .map(
      ([name, value], i) =>
        `<div class="chart-legend-row"><span class="chart-legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${name} — ${formatMoney(value)} (${Math.round((value / grandTotal) * 100)}%)</div>`
    )
    .join("");
}
