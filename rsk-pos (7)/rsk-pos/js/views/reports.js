import { state, formatMoney } from "../store.js";
import { escapeHtml } from "../router.js";

export async function renderReports(root) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  draw(root, { start: toInputDate(start), end: toInputDate(end) });
}

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

function draw(root, range) {
  const start = new Date(range.start + "T00:00:00");
  const end = new Date(range.end + "T23:59:59");
  const filtered = state.sales.filter(s => {
    const d = new Date(s.DateTime);
    return d >= start && d <= end;
  });

  const byDay = buildDailyTotals(filtered, start, end);
  const revenue = filtered.reduce((sum, s) => sum + Number(s.Total), 0);
  const topProducts = buildTopProducts(filtered);

  root.innerHTML = `
    <div class="page-header"><h1>Reports</h1></div>

    <div class="panel">
      <div class="filter-row">
        <label class="field field-inline"><span>From</span><input class="input" type="date" id="start-date" value="${range.start}" /></label>
        <label class="field field-inline"><span>To</span><input class="input" type="date" id="end-date" value="${range.end}" /></label>
        <div class="filter-summary">
          <span>${filtered.length} sale${filtered.length === 1 ? "" : "s"}</span>
          <span class="mono">${formatMoney(revenue)}</span>
        </div>
      </div>
      <canvas id="revenue-chart" height="220"></canvas>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Top products</h2></div>
      <table class="table">
        <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead>
        <tbody>
          ${
            topProducts.length === 0
              ? `<tr><td colspan="3"><p class="empty">No sales in this range.</p></td></tr>`
              : topProducts
                  .map(
                    p => `<tr><td>${escapeHtml(p.name)}</td><td class="mono">${p.qty}</td><td class="mono">${formatMoney(p.revenue)}</td></tr>`
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
  `;

  root.querySelector("#start-date").addEventListener("change", e => draw(root, { ...range, start: e.target.value }));
  root.querySelector("#end-date").addEventListener("change", e => draw(root, { ...range, end: e.target.value }));

  drawChart(root.querySelector("#revenue-chart"), byDay);
}

function buildDailyTotals(sales, start, end) {
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({ label: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }), key: toInputDate(cursor), total: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const map = new Map(days.map(d => [d.key, d]));
  sales.forEach(s => {
    const key = toInputDate(new Date(s.DateTime));
    if (map.has(key)) map.get(key).total += Number(s.Total);
  });
  return days;
}

function buildTopProducts(sales) {
  const totals = new Map();
  sales.forEach(s => {
    s.Items.forEach(i => {
      const entry = totals.get(i.name) || { name: i.name, qty: 0, revenue: 0 };
      entry.qty += Number(i.qty);
      entry.revenue += Number(i.qty) * Number(i.price);
      totals.set(i.name, entry);
    });
  });
  return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function drawChart(canvas, days) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const max = Math.max(...days.map(d => d.total), 1);
  const paddingLeft = 8;
  const paddingBottom = 28;
  const chartHeight = height - paddingBottom - 10;
  const barGap = 6;
  const barWidth = Math.max((width - paddingLeft * 2 - barGap * (days.length - 1)) / days.length, 4);

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1FB6E8";

  days.forEach((d, i) => {
    const x = paddingLeft + i * (barWidth + barGap);
    const barHeight = (d.total / max) * chartHeight;
    const y = chartHeight - barHeight + 10;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.save();
    ctx.translate(x + barWidth / 2, height - 6);
    ctx.rotate(days.length > 10 ? -Math.PI / 3 : 0);
    ctx.fillStyle = "#64707B";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = days.length > 10 ? "right" : "center";
    ctx.fillText(d.label, 0, 0);
    ctx.restore();
  });
}
