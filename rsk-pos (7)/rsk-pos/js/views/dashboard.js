import { state, formatMoney, lowStockProducts } from "../store.js";
import { navigate } from "../router.js";

export async function renderDashboard(root) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysSales = state.sales.filter(s => new Date(s.DateTime) >= today);
  const todaysRevenue = todaysSales.reduce((sum, s) => sum + Number(s.Total), 0);
  const lowStock = lowStockProducts();

  root.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <button class="btn btn-primary" id="go-new-sale">+ New sale</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Today's revenue</span>
        <span class="stat-value mono">${formatMoney(todaysRevenue)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Transactions today</span>
        <span class="stat-value mono">${todaysSales.length}</span>
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
}
