// ============================================================
// RSK POS — Data store
// Loads sheet data into memory, exposes it to the views, and
// writes changes back through sheetsApi. Keeping one in-memory
// copy avoids refetching the whole sheet after every click.
// ============================================================

import * as api from "./sheetsApi.js";
import { CONFIG } from "./config.js";

export const state = {
  products: [],
  sales: [],
  customers: [],
  settings: {},
  loaded: false
};

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export async function loadAll() {
  const [products, sales, customers, settingsRows] = await Promise.all([
    api.getAll("Products"),
    api.getAll("Sales"),
    api.getAll("Customers"),
    api.getAll("Settings")
  ]);
  state.products = products.map(p => ({
    ...p,
    CostPrice: Number(p.CostPrice) || 0,
    SellPrice: Number(p.SellPrice) || 0,
    Stock: Number(p.Stock) || 0,
    LowStockAt: Number(p.LowStockAt) || CONFIG.DEFAULT_LOW_STOCK_THRESHOLD,
    Active: p.Active !== "FALSE"
  }));
  state.sales = sales
    .map(s => ({ ...s, Items: safeParse(s.ItemsJSON) }))
    .sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));
  state.customers = customers;
  state.settings = {};
  settingsRows.forEach(row => (state.settings[row.Key] = row.Value));
  state.loaded = true;
}

function safeParse(json) {
  try {
    return JSON.parse(json || "[]");
  } catch {
    return [];
  }
}

export function setting(key, fallback = "") {
  return state.settings[key] ?? fallback;
}

export function currency() {
  return setting("Currency", CONFIG.CURRENCY);
}

export function taxRate() {
  return Number(setting("TaxRate", CONFIG.DEFAULT_TAX_RATE)) || 0;
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `${currency()} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------- Products ----------

export async function addProduct(product) {
  const row = {
    ID: genId("P"),
    SKU: product.SKU,
    Name: product.Name,
    Category: product.Category,
    CostPrice: product.CostPrice,
    SellPrice: product.SellPrice,
    Stock: product.Stock,
    LowStockAt: product.LowStockAt || CONFIG.DEFAULT_LOW_STOCK_THRESHOLD,
    Active: "TRUE"
  };
  await api.appendRows("Products", [api.objectToRow("Products", row)]);
  state.products.push({ ...row, CostPrice: Number(row.CostPrice), SellPrice: Number(row.SellPrice), Stock: Number(row.Stock), LowStockAt: Number(row.LowStockAt), Active: true });
  return row;
}

export async function updateProduct(product) {
  await api.updateRow("Products", product._row, api.objectToRow("Products", { ...product, Active: product.Active ? "TRUE" : "FALSE" }));
  const idx = state.products.findIndex(p => p.ID === product.ID);
  if (idx >= 0) state.products[idx] = { ...product };
}

export async function deactivateProduct(product) {
  await updateProduct({ ...product, Active: false });
}

export async function adjustStock(productId, delta) {
  const product = state.products.find(p => p.ID === productId);
  if (!product) return;
  product.Stock = Number(product.Stock) + delta;
  await api.updateRow("Products", product._row, api.objectToRow("Products", { ...product, Active: product.Active ? "TRUE" : "FALSE" }));
}

export function lowStockProducts() {
  return state.products.filter(p => p.Active && p.Stock <= p.LowStockAt);
}

// ---------- Sales ----------

export function computeCartTotals(cart, discount = 0) {
  const subtotal = cart.reduce((sum, item) => sum + item.SellPrice * item.qty, 0);
  const discounted = Math.max(subtotal - Number(discount || 0), 0);
  const tax = discounted * (taxRate() / 100);
  const total = discounted + tax;
  return { subtotal, tax, total };
}

export async function recordSale({ cart, discount, paymentMethod, customerName, customerPhone, cashierEmail }) {
  const { subtotal, tax, total } = computeCartTotals(cart, discount);
  const sale = {
    ID: genId("S"),
    DateTime: new Date().toISOString(),
    CustomerName: customerName || "",
    CustomerPhone: customerPhone || "",
    ItemsJSON: JSON.stringify(cart.map(i => ({ id: i.ID, name: i.Name, qty: i.qty, price: i.SellPrice }))),
    Subtotal: subtotal.toFixed(2),
    Discount: Number(discount || 0).toFixed(2),
    Tax: tax.toFixed(2),
    Total: total.toFixed(2),
    PaymentMethod: paymentMethod,
    CashierEmail: cashierEmail
  };
  await api.appendRows("Sales", [api.objectToRow("Sales", sale)]);

  for (const item of cart) {
    await adjustStock(item.ID, -item.qty);
  }

  state.sales.unshift({ ...sale, Items: JSON.parse(sale.ItemsJSON) });
  return sale;
}

export function salesBetween(startDate, endDate) {
  return state.sales.filter(s => {
    const d = new Date(s.DateTime);
    return d >= startDate && d <= endDate;
  });
}

// ---------- Customers ----------

export async function addCustomer(customer) {
  const row = { ID: genId("C"), Name: customer.Name, Phone: customer.Phone, Email: customer.Email || "", Notes: customer.Notes || "" };
  await api.appendRows("Customers", [api.objectToRow("Customers", row)]);
  state.customers.push(row);
  return row;
}

export async function updateCustomer(customer) {
  await api.updateRow("Customers", customer._row, api.objectToRow("Customers", customer));
  const idx = state.customers.findIndex(c => c.ID === customer.ID);
  if (idx >= 0) state.customers[idx] = { ...customer };
}

// ---------- Settings ----------

export async function updateSettings(newSettings) {
  for (const [key, value] of Object.entries(newSettings)) {
    const existingRows = await api.getAll("Settings");
    const found = existingRows.find(r => r.Key === key);
    if (found) {
      await api.updateRow("Settings", found._row, [key, value]);
    } else {
      await api.appendRows("Settings", [[key, value]]);
    }
    state.settings[key] = value;
  }
}
