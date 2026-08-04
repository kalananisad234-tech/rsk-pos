import {
  state,
  formatMoney,
  lowStockProducts,
  salesOnDay,
  salesInMonth,
  totalRevenue,
  totalProfit,
  dayTarget,
  monthlyTarget
} from "../store.js";
import { navigate } from "../router.js";

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

function toInputMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function renderDashboard(root) {
  draw(root, { day: toInputDate(new Date()), month: toInputMonth(new Date()) });
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
  const [y, m] = filters.month.split("-").map(Number);
  const monthDate = new Date(y, m - 1, 1);

  const daySales = salesOnDay(dayDate);
  const monthSales = salesInMonth(monthDate);

  const dayActual = totalRevenue(daySales);
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
        <label class="field field-inline"><span>Day KPIs for</span><input class="input" type="date" id="day-filter" value="${filters.day}" /></label>
        <label class="field field-inline"><span>Monthly KPIs for</span><input class="input" type="month" id="month-filter" value="${filters.month}" /></label>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Day target vs actual</span>
        <span class="stat-value mono">${formatMoney(dayActual)}</span>
        ${progressBar(dayActual, dayTarget())}
      </div>
      <div class="stat-card">
        <span class="stat-label">Monthly target vs actual</span>
        <span class="stat-value mono">${formatMoney(monthActual)}</span>
        ${progressBar(monthActual, monthlyTarget())}
      </div>
      <div class="stat-card">
        <span class="stat-label">Day profit</span>
        <span class="stat-value mono">${formatMoney(dayProfit)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Monthly profit</span>
        <span class="stat-value mono">${formatMoney(monthProfit)}</span>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Transactions (selected day)</span>
        <span class="stat-value mono">${daySales.length}</span>
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
  root.querySelector("#month-filter").addEventListener("change", e => draw(root, { ...filters, month: e.target.value }));
}
