import { state, formatMoney } from "../store.js";
import { escapeHtml } from "../router.js";
import { renderInvoiceHTML } from "../receiptTemplate.js";

export async function renderSalesHistory(root) {
  draw(root, { ...defaultRange(), payment: "All", cashier: "All", search: "", warrantyOnly: false });
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: toInputDate(start), end: toInputDate(end) };
}

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

function cashierList() {
  return [...new Set(state.sales.map(s => s.CashierEmail).filter(Boolean))].sort();
}

function applyFilters(f) {
  const start = new Date(f.start + "T00:00:00");
  const end = new Date(f.end + "T23:59:59");
  const term = f.search.trim().toLowerCase();
  return state.sales.filter(s => {
    const d = new Date(s.DateTime);
    if (d < start || d > end) return false;
    if (f.payment !== "All" && s.PaymentMethod !== f.payment) return false;
    if (f.cashier !== "All" && s.CashierEmail !== f.cashier) return false;
    if (f.warrantyOnly && !s.HasWarranty) return false;
    if (term && !(s.ID.toLowerCase().includes(term) || (s.CustomerName || "").toLowerCase().includes(term))) return false;
    return true;
  });
}

function draw(root, f) {
  const filtered = applyFilters(f);
  const revenue = filtered.reduce((sum, s) => sum + Number(s.Total), 0);

  root.innerHTML = `
    <div class="page-header">
      <h1>Sales history</h1>
    </div>

    <div class="panel">
      <div class="filter-row">
        <label class="field field-inline"><span>From</span><input class="input" type="date" id="start-date" value="${f.start}" /></label>
        <label class="field field-inline"><span>To</span><input class="input" type="date" id="end-date" value="${f.end}" /></label>
        <label class="field field-inline">
          <span>Payment</span>
          <select class="input" id="payment-filter">
            ${["All", "Cash", "Card", "Bank Transfer", "Other"].map(p => `<option value="${p}" ${f.payment === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </label>
        <label class="field field-inline">
          <span>Cashier</span>
          <select class="input" id="cashier-filter">
            <option value="All" ${f.cashier === "All" ? "selected" : ""}>All</option>
            ${cashierList().map(c => `<option value="${escapeHtml(c)}" ${f.cashier === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
        </label>
        <div class="filter-summary">
          <span>${filtered.length} sale${filtered.length === 1 ? "" : "s"}</span>
          <span class="mono">${formatMoney(revenue)}</span>
        </div>
      </div>
      <div class="filter-row">
        <input class="input" id="search-filter" placeholder="Search receipt no. or customer name…" value="${escapeHtml(f.search)}" style="max-width:320px;" />
        <label class="field field-inline field-checkbox">
          <input type="checkbox" id="warranty-filter" ${f.warrantyOnly ? "checked" : ""} />
          <span>✅ Warranty only</span>
        </label>
      </div>

      <table class="table">
        <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Payment</th><th>Cashier</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${
            filtered.length === 0
              ? `<tr><td colspan="8"><p class="empty">No sales match these filters.</p></td></tr>`
              : filtered
                  .map(
                    s => `<tr class="row-clickable" data-id="${s.ID}">
                <td class="mono">${new Date(s.DateTime).toLocaleString()}</td>
                <td class="mono">${s.ID}${s.HasWarranty ? ` <span title="Under warranty">✅</span>` : ""}</td>
                <td>${escapeHtml(s.CustomerName || "Walk-in")}</td>
                <td>${s.Items.reduce((n, i) => n + Number(i.qty), 0)}</td>
                <td>${escapeHtml(s.PaymentMethod)}</td>
                <td>${escapeHtml(s.CashierEmail)}</td>
                <td class="mono">${formatMoney(s.Total)}</td>
                <td><button class="btn btn-sm" data-print="${s.ID}">Print</button></td>
              </tr>`
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
    <div id="sale-detail-modal"></div>
  `;

  const update = patch => draw(root, { ...f, ...patch });

  root.querySelector("#start-date").addEventListener("change", e => update({ start: e.target.value }));
  root.querySelector("#end-date").addEventListener("change", e => update({ end: e.target.value }));
  root.querySelector("#payment-filter").addEventListener("change", e => update({ payment: e.target.value }));
  root.querySelector("#cashier-filter").addEventListener("change", e => update({ cashier: e.target.value }));
  root.querySelector("#warranty-filter").addEventListener("change", e => update({ warrantyOnly: e.target.checked }));
  root.querySelector("#search-filter").addEventListener("input", e => update({ search: e.target.value }));

  root.querySelectorAll(".row-clickable").forEach(tr =>
    tr.addEventListener("click", e => {
      if (e.target.closest("[data-print]")) return; // handled separately below
      showDetail(root, filtered.find(s => s.ID === tr.dataset.id));
    })
  );

  root.querySelectorAll("[data-print]").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      showDetail(root, filtered.find(s => s.ID === btn.dataset.print), { autoPrint: true });
    })
  );
}

function showDetail(root, sale, { autoPrint = false } = {}) {
  const modal = root.querySelector("#sale-detail-modal");
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="invoice" id="receipt-print">${renderInvoiceHTML(sale)}</div>
      <div class="modal-actions">
        <button class="btn" id="close-detail">Close</button>
        <button class="btn btn-primary" id="print-detail">Print</button>
      </div>
    </div>
  `;
  modal.querySelector("#close-detail").addEventListener("click", () => (modal.innerHTML = ""));
  modal.querySelector("#print-detail").addEventListener("click", () => window.print());
  if (autoPrint) window.print();
}
