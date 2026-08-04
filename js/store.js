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
    .map(s => ({ ...s, Items: safeParse(s.ItemsJSON), HasWarranty: s.HasWarranty === "TRUE" }))
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
  const rowNumber = await api.appendSingleRow("Products", api.objectToRow("Products", row));
  const stored = {
    ...row,
    _row: rowNumber,
    CostPrice: Number(row.CostPrice),
    SellPrice: Number(row.SellPrice),
    Stock: Number(row.Stock),
    LowStockAt: Number(row.LowStockAt),
    Active: true
  };
  state.products.push(stored);
  return stored;
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
  if (!product || product._row == null) return;
  product.Stock = Number(product.Stock) + delta;
  await api.updateRow("Products", product._row, api.objectToRow("Products", { ...product, Active: product.Active ? "TRUE" : "FALSE" }));
}

export function lowStockProducts() {
  return state.products.filter(p => p.Active && p.Stock <= p.LowStockAt);
}

/** Categories for the New Sale quick-filter strip: pinned ones first (in the configured
 * order, only if at least one active product uses them), then any others found, A-Z. */
export function categoriesList() {
  const found = new Set(state.products.filter(p => p.Active && p.Category).map(p => p.Category));
  const pinned = CONFIG.PINNED_CATEGORIES.filter(c => found.has(c));
  const rest = [...found].filter(c => !CONFIG.PINNED_CATEGORIES.includes(c)).sort();
  return [...pinned, ...rest];
}

// ---------- Sales ----------

export function computeCartTotals(cart, discount = 0) {
  const subtotal = cart.reduce((sum, item) => sum + item.SellPrice * item.qty, 0);
  const discounted = Math.max(subtotal - Number(discount || 0), 0);
  const tax = discounted * (taxRate() / 100);
  const total = discounted + tax;
  return { subtotal, tax, total };
}

export async function recordSale({ cart, discount, paymentMethod, customerName, customerPhone, cashierEmail, warranty }) {
  const { subtotal, tax, total } = computeCartTotals(cart, discount);
  const sale = {
    ID: genId("S"),
    DateTime: new Date().toISOString(),
    CustomerName: customerName || "",
    CustomerPhone: customerPhone || "",
    ItemsJSON: JSON.stringify(
      cart.map(i => ({ id: i.ID, name: i.Name, qty: i.qty, price: i.SellPrice, cost: Number(i.CostPrice) || 0 }))
    ),
    Subtotal: subtotal.toFixed(2),
    Discount: Number(discount || 0).toFixed(2),
    Tax: tax.toFixed(2),
    Total: total.toFixed(2),
    PaymentMethod: paymentMethod,
    CashierEmail: cashierEmail,
    HasWarranty: warranty?.enabled ? "TRUE" : "FALSE",
    WarrantyNo: warranty?.no || "",
    WarrantyTillDate: warranty?.tillDate || "",
    WarrantyNotes: warranty?.notes || ""
  };
  await api.appendRows("Sales", [api.objectToRow("Sales", sale)]);

  for (const item of cart) {
    await adjustStock(item.ID, -item.qty);
  }

  state.sales.unshift({ ...sale, Items: JSON.parse(sale.ItemsJSON), HasWarranty: sale.HasWarranty === "TRUE" });
  return sale;
}

export function salesBetween(start, end) {
  return state.sales.filter(s => {
    const d = new Date(s.DateTime);
    return d >= start && d <= end;
  });
}

export function saleRevenue(sale) {
  return Number(sale.Total) || 0;
}

export function saleProfit(sale) {
  const itemsProfit = (sale.Items || []).reduce((sum, i) => sum + (Number(i.price) - Number(i.cost || 0)) * Number(i.qty), 0);
  return itemsProfit - (Number(sale.Discount) || 0);
}

export function totalRevenue(sales) {
  return sales.reduce((sum, s) => sum + saleRevenue(s), 0);
}

export function totalProfit(sales) {
  return sales.reduce((sum, s) => sum + saleProfit(s), 0);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function salesOnDay(date) {
  return salesBetween(startOfDay(date), endOfDay(date));
}

export function salesInWeek(date) {
  return salesBetween(startOfWeek(date), endOfWeek(date));
}

export function salesInMonth(date) {
  return salesBetween(startOfMonth(date), endOfMonth(date));
}

export function dayTarget() {
  return Number(setting("DayTarget", CONFIG.DEFAULT_DAY_TARGET)) || 0;
}

export function weeklyTarget() {
  return Number(setting("WeeklyTarget", CONFIG.DEFAULT_WEEKLY_TARGET)) || 0;
}

export function monthlyTarget() {
  return Number(setting("MonthlyTarget", CONFIG.DEFAULT_MONTHLY_TARGET)) || 0;
}

/** Category of the product a sold line item belonged to, for chart slicers (falls back to "Uncategorized"). */
export function itemCategory(item) {
  const product = state.products.find(p => p.ID === item.id);
  return (product && product.Category) || "Uncategorized";
}

/** Filters sales for chart slicers: by payment method, and/or by category (kept only if at least
 * one line item in the sale belongs to that category — used alongside per-item revenue sums). */
export function filterSales(sales, { payment = "All" } = {}) {
  return sales.filter(s => payment === "All" || s.PaymentMethod === payment);
}

// ---------- Security ----------

export function passwordProtectionEnabled() {
  return setting("PasswordEnabled", "FALSE") === "TRUE";
}

export function checkPassword(candidate) {
  return candidate === setting("SettingsPassword", "");
}

// ---------- Customers ----------

export async function addCustomer(customer) {
  const row = { ID: genId("C"), Name: customer.Name, Phone: customer.Phone, Email: customer.Email || "", Notes: customer.Notes || "" };
  const rowNumber = await api.appendSingleRow("Customers", api.objectToRow("Customers", row));
  const stored = { ...row, _row: rowNumber };
  state.customers.push(stored);
  return stored;
}

export async function updateCustomer(customer) {
  await api.updateRow("Customers", customer._row, api.objectToRow("Customers", customer));
  const idx = state.customers.findIndex(c => c.ID === customer.ID);
  if (idx >= 0) state.customers[idx] = { ...customer };
}

// ---------- Settings ----------

export async function updateSettings(newSettings) {
  const existingRows = await api.getAll("Settings");
  for (const [key, value] of Object.entries(newSettings)) {
    const found = existingRows.find(r => r.Key === key);
    if (found) {
      await api.updateRow("Settings", found._row, [key, value]);
    } else {
      await api.appendRows("Settings", [[key, value]]);
    }
    state.settings[key] = value;
  }
}
