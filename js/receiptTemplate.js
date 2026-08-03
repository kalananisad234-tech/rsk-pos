// ============================================================
// RSK POS — Printable invoice/bill template
// Shared by the checkout screen and the "reprint" button in
// Sales History, so both always look identical and only need
// updating in one place.
// ============================================================

import { formatMoney, setting } from "./store.js";
import { escapeHtml } from "./router.js";

export function renderInvoiceHTML(sale) {
  const items = Array.isArray(sale.Items)
    ? sale.Items
    : JSON.parse(typeof sale.Items === "string" ? sale.Items : "[]");

  const shopName = setting("ShopName");
  const address = setting("ShopAddress");
  const phone = setting("ShopPhone");
  const regNo = setting("RegNo");
  const since = setting("SinceYear");
  const tagline = setting("Tagline", "Your IT Solution");

  return `
    <div class="invoice-topbar">
      <div class="invoice-ribbon invoice-ribbon--left">INVOICE</div>
      <div class="invoice-brand">
        <img src="assets/logo.png" alt="" class="invoice-logo" />
        <div class="invoice-brand-text">
          <div class="invoice-shop-name">${escapeHtml(shopName)}</div>
          ${address ? `<div class="invoice-contact">${escapeHtml(address)}</div>` : ""}
          ${phone ? `<div class="invoice-contact mono">${escapeHtml(phone)}</div>` : ""}
        </div>
      </div>
      <div class="invoice-ribbon invoice-ribbon--right">${escapeHtml(tagline)}</div>
    </div>

    <div class="invoice-rule"></div>

    <div class="invoice-meta-row">
      <span>No: <span class="mono">${escapeHtml(sale.ID)}</span></span>
      <span class="mono">${new Date(sale.DateTime).toLocaleString()}</span>
    </div>
    ${
      sale.CustomerName
        ? `<div class="invoice-meta-row"><span>Customer: ${escapeHtml(sale.CustomerName)}</span>${sale.CustomerPhone ? `<span class="mono">${escapeHtml(sale.CustomerPhone)}</span>` : ""}</div>`
        : ""
    }

    <div class="invoice-rule invoice-rule--dashed"></div>

    ${items
      .map(
        i => `<div class="receipt-line">
          <span>${escapeHtml(i.name)} ×${i.qty}</span>
          <span class="mono">${formatMoney(i.price * i.qty)}</span>
        </div>`
      )
      .join("")}

    <div class="invoice-rule invoice-rule--dashed"></div>

    <div class="receipt-line"><span>Subtotal</span><span class="mono">${formatMoney(sale.Subtotal)}</span></div>
    <div class="receipt-line"><span>Discount</span><span class="mono">-${formatMoney(sale.Discount)}</span></div>
    <div class="receipt-line"><span>Tax</span><span class="mono">${formatMoney(sale.Tax)}</span></div>
    <div class="receipt-line receipt-line--total"><span>Total</span><span class="mono">${formatMoney(sale.Total)}</span></div>

    <div class="invoice-rule"></div>
    <div class="invoice-thankyou">${escapeHtml(setting("ReceiptFooter"))}</div>

    <div class="invoice-footer-row">
      <span>${since ? `Since ${escapeHtml(since)}` : ""}</span>
      <span class="invoice-social">Facebook &middot; Koko &middot; Daraz</span>
      <span>${regNo ? `Reg No: ${escapeHtml(regNo)}` : ""}</span>
    </div>
  `;
}
