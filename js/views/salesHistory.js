import { state, formatMoney, setting } from "../store.js";
import { escapeHtml } from "../router.js";

export async function renderSalesHistory(root) {
  draw(root, defaultRange());
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

function draw(root, range) {
  const start = new Date(range.start + "T00:00:00");
  const end = new Date(range.end + "T23:59:59");
  const filtered = state.sales.filter(s => {
    const d = new Date(s.DateTime);
    return d >= start && d <= end;
  });
  const revenue = filtered.reduce((sum, s) => sum + Number(s.Total), 0);

  root.innerHTML = `
    <div class="page-header">
      <h1>Sales history</h1>
    </div>

    <div class="panel">
      <div class="filter-row">
        <label class="field field-inline"><span>From</span><input class="input" type="date" id="start-date" value="${range.start}" /></label>
        <label class="field field-inline"><span>To</span><input class="input" type="date" id="end-date" value="${range.end}" /></label>
        <div class="filter-summary">
          <span>${filtered.length} sale${filtered.length === 1 ? "" : "s"}</span>
          <span class="mono">${formatMoney(revenue)}</span>
        </div>
      </div>

      <table class="table">
        <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Payment</th><th>Cashier</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${
            filtered.length === 0
              ? `<tr><td colspan="8"><p class="empty">No sales in this range.</p></td></tr>`
              : filtered
                  .map(
                    s => `<tr class="row-clickable" data-id="${s.ID}">
                <td class="mono">${new Date(s.DateTime).toLocaleString()}</td>
                <td class="mono">${s.ID}</td>
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

  root.querySelector("#start-date").addEventListener("change", e => draw(root, { ...range, start: e.target.value }));
  root.querySelector("#end-date").addEventListener("change", e => draw(root, { ...range, end: e.target.value }));

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
      <div class="receipt" id="receipt-print">
        <div class="receipt-shop">${escapeHtml(setting("ShopName"))}</div>
        <div class="receipt-meta mono">${new Date(sale.DateTime).toLocaleString()}</div>
        <div class="receipt-meta mono">Receipt ${sale.ID}</div>
        <div class="receipt-rule"></div>
        ${sale.Items.map(
          i => `<div class="receipt-line">
              <span>${escapeHtml(i.name)} ×${i.qty}</span>
              <span class="mono">${formatMoney(i.price * i.qty)}</span>
            </div>`
        ).join("")}
        <div class="receipt-rule"></div>
        <div class="receipt-line"><span>Subtotal</span><span class="mono">${formatMoney(sale.Subtotal)}</span></div>
        <div class="receipt-line"><span>Discount</span><span class="mono">-${formatMoney(sale.Discount)}</span></div>
        <div class="receipt-line"><span>Tax</span><span class="mono">${formatMoney(sale.Tax)}</span></div>
        <div class="receipt-line receipt-line--total"><span>Total</span><span class="mono">${formatMoney(sale.Total)}</span></div>
        <div class="receipt-rule"></div>
        <div class="receipt-footer">${escapeHtml(setting("ReceiptFooter"))}</div>
      </div>
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
