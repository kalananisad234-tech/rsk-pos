import { state, formatMoney, computeCartTotals, recordSale, setting } from "../store.js";
import { getCurrentUser } from "../auth.js";
import { escapeHtml } from "../router.js";
import { renderInvoiceHTML } from "../receiptTemplate.js";

let cart = []; // [{...product, qty}]
let discount = 0;
let searchTerm = "";

function findCartItem(id) {
  return cart.find(i => i.ID === id);
}

function addToCart(product) {
  const existing = findCartItem(product.ID);
  if (existing) {
    if (existing.qty < product.Stock) existing.qty += 1;
  } else if (product.Stock > 0) {
    cart.push({ ...product, qty: 1 });
  }
}

function changeQty(id, delta) {
  const item = findCartItem(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.ID !== id);
  } else if (item.qty > item.Stock) {
    item.qty = item.Stock;
  }
}

export async function renderPOS(root) {
  draw(root);
}

function renderProductCards(products) {
  if (products.length === 0) return `<p class="empty">No matching products.</p>`;
  return products
    .map(
      p => `
    <button class="product-card ${p.Stock === 0 ? "product-card--out" : ""}" data-id="${p.ID}" ${p.Stock === 0 ? "disabled" : ""}>
      <span class="product-card-name">${escapeHtml(p.Name)}</span>
      <span class="product-card-sku mono">${escapeHtml(p.SKU)}</span>
      <span class="product-card-price mono">${formatMoney(p.SellPrice)}</span>
      <span class="product-card-stock mono ${p.Stock <= p.LowStockAt ? "text-warn" : ""}">${p.Stock} in stock</span>
    </button>`
    )
    .join("");
}

function bindProductGrid(root) {
  root.querySelectorAll(".product-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const product = state.products.find(p => p.ID === btn.dataset.id);
      addToCart(product);
      draw(root);
    });
  });
}

function draw(root) {
  const filtered = state.products.filter(
    p =>
      p.Active &&
      (p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.SKU.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const { subtotal, tax, total } = computeCartTotals(cart, discount);

  root.innerHTML = `
    <div class="page-header">
      <h1>New sale</h1>
    </div>
    <div class="pos-layout">
      <div class="pos-catalog">
        <input class="input" id="product-search" placeholder="Search by name or SKU…" value="${escapeHtml(searchTerm)}" />
        <div class="product-grid" id="product-grid">${renderProductCards(filtered)}</div>
      </div>

      <div class="pos-cart">
        <h2>Cart</h2>
        ${
          cart.length === 0
            ? `<p class="empty">Tap a product to add it.</p>`
            : `<div class="cart-list">
                ${cart
                  .map(
                    i => `
                  <div class="cart-row" data-id="${i.ID}">
                    <div class="cart-row-info">
                      <span class="cart-row-name">${escapeHtml(i.Name)}</span>
                      <span class="cart-row-price mono">${formatMoney(i.SellPrice)} each</span>
                    </div>
                    <div class="qty-control">
                      <button class="qty-btn" data-action="dec">−</button>
                      <span class="mono">${i.qty}</span>
                      <button class="qty-btn" data-action="inc">+</button>
                    </div>
                    <span class="cart-row-total mono">${formatMoney(i.SellPrice * i.qty)}</span>
                  </div>`
                  )
                  .join("")}
              </div>`
        }

        <div class="cart-form">
          <label class="field">
            <span>Customer name (optional)</span>
            <input class="input" id="customer-name" placeholder="Walk-in" />
          </label>
          <label class="field">
            <span>Customer phone (optional)</span>
            <input class="input" id="customer-phone" />
          </label>
          <label class="field">
            <span>Discount (${setting("Currency")})</span>
            <input class="input" id="discount" type="number" min="0" step="0.01" value="${discount}" />
          </label>
          <label class="field">
            <span>Payment method</span>
            <select class="input" id="payment-method">
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank transfer</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div class="cart-totals">
          <div class="cart-totals-row"><span>Subtotal</span><span class="mono">${formatMoney(subtotal)}</span></div>
          <div class="cart-totals-row"><span>Tax</span><span class="mono">${formatMoney(tax)}</span></div>
          <div class="cart-totals-row cart-totals-row--grand"><span>Total</span><span class="mono">${formatMoney(total)}</span></div>
        </div>

        <button class="btn btn-primary btn-block" id="checkout-btn" ${cart.length === 0 ? "disabled" : ""}>
          Complete sale
        </button>
      </div>
    </div>
    <div id="receipt-overlay"></div>
  `;

  root.querySelector("#product-search").addEventListener("input", e => {
    searchTerm = e.target.value;
    const grid = root.querySelector("#product-grid");
    const stillFiltered = state.products.filter(
      p =>
        p.Active &&
        (p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.SKU.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    grid.innerHTML = renderProductCards(stillFiltered);
    bindProductGrid(root);
  });

  bindProductGrid(root);

  root.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".cart-row");
      changeQty(row.dataset.id, btn.dataset.action === "inc" ? 1 : -1);
      draw(root);
    });
  });

  const discountInput = root.querySelector("#discount");
  discountInput.addEventListener("input", () => {
    discount = Number(discountInput.value) || 0;
    const { subtotal, tax, total } = computeCartTotals(cart, discount);
    const rows = root.querySelectorAll(".cart-totals-row .mono");
    if (rows.length === 3) {
      rows[0].textContent = formatMoney(subtotal);
      rows[1].textContent = formatMoney(tax);
      rows[2].textContent = formatMoney(total);
    }
  });

  const checkoutBtn = root.querySelector("#checkout-btn");
  checkoutBtn.addEventListener("click", async () => {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Processing…";
    try {
      const sale = await recordSale({
        cart,
        discount,
        paymentMethod: root.querySelector("#payment-method").value,
        customerName: root.querySelector("#customer-name").value,
        customerPhone: root.querySelector("#customer-phone").value,
        cashierEmail: getCurrentUser()?.email || ""
      });
      showReceipt(root, sale);
      cart = [];
      discount = 0;
    } catch (err) {
      alert(`Could not complete the sale: ${err.message}`);
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Complete sale";
    }
  });
}

function showReceipt(root, sale) {
  const overlay = root.querySelector("#receipt-overlay");
  overlay.innerHTML = `
    <div class="modal-backdrop">
      <div class="invoice" id="receipt-print">${renderInvoiceHTML(sale)}</div>
      <div class="modal-actions">
        <button class="btn" id="close-receipt">Close</button>
        <button class="btn btn-primary" id="print-receipt">Print</button>
      </div>
    </div>
  `;
  overlay.querySelector("#close-receipt").addEventListener("click", () => (overlay.innerHTML = ""));
  overlay.querySelector("#print-receipt").addEventListener("click", () => window.print());
}
