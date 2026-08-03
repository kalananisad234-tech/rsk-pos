// ============================================================
// RSK POS — Google Sheets API wrapper
// All data (products, sales, customers, settings) lives in the
// shop's own Google Sheet. This module is the only place that
// talks to the Sheets REST API.
// ============================================================

import { CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const SHEETS = {
  Products: ["ID", "SKU", "Name", "Category", "CostPrice", "SellPrice", "Stock", "LowStockAt", "Active"],
  Sales: ["ID", "DateTime", "CustomerName", "CustomerPhone", "ItemsJSON", "Subtotal", "Discount", "Tax", "Total", "PaymentMethod", "CashierEmail"],
  Customers: ["ID", "Name", "Phone", "Email", "Notes"],
  Settings: ["Key", "Value"]
};

async function sheetsFetch(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(`${BASE}/${CONFIG.SPREADSHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Makes sure every required tab exists in the spreadsheet, creating
 * any that are missing and writing their header row. Safe to call
 * on every app load.
 */
export async function ensureSchema() {
  const meta = await sheetsFetch("?fields=sheets.properties.title");
  const existing = new Set(meta.sheets.map(s => s.properties.title));
  const missing = Object.keys(SHEETS).filter(name => !existing.has(name));

  if (missing.length > 0) {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map(title => ({ addSheet: { properties: { title } } }))
      })
    });
    for (const title of missing) {
      await sheetsFetch(`/values/${encodeURIComponent(title)}!A1:Z1?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        body: JSON.stringify({ values: [SHEETS[title]] })
      });
    }
    if (missing.includes("Settings")) {
      await seedDefaultSettings();
    }
  }

  if (!missing.includes("Settings")) {
    await backfillSettingsKeys();
  }
}

/**
 * Adds any settings keys introduced in a later version of the app to a
 * spreadsheet that was already set up before those keys existed, so
 * upgrades don't require manually editing the sheet.
 */
async function backfillSettingsKeys() {
  const rows = await getAll("Settings");
  const present = new Set(rows.map(r => r.Key));
  const defaults = defaultSettingsList().filter(([key]) => !present.has(key));
  if (defaults.length > 0) {
    await appendRows("Settings", defaults);
  }
}

function defaultSettingsList() {
  return [
    ["ShopName", CONFIG.SHOP_NAME],
    ["ShopAddress", CONFIG.SHOP_ADDRESS],
    ["ShopPhone", CONFIG.SHOP_PHONE],
    ["RegNo", CONFIG.REG_NO],
    ["SinceYear", CONFIG.SINCE_YEAR],
    ["Tagline", CONFIG.TAGLINE],
    ["ReceiptFooter", CONFIG.RECEIPT_FOOTER],
    ["Currency", CONFIG.CURRENCY],
    ["TaxRate", String(CONFIG.DEFAULT_TAX_RATE)],
    ["LowStockThreshold", String(CONFIG.DEFAULT_LOW_STOCK_THRESHOLD)]
  ];
}

async function seedDefaultSettings() {
  await appendRows("Settings", defaultSettingsList());
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const [header, ...rows] = values;
  return rows
    .filter(r => r.some(cell => cell !== "" && cell !== undefined))
    .map((row, i) => {
      const obj = { _row: i + 2 }; // 1-indexed + header row
      header.forEach((key, idx) => (obj[key] = row[idx] ?? ""));
      return obj;
    });
}

export async function getAll(sheetName) {
  const data = await sheetsFetch(`/values/${encodeURIComponent(sheetName)}`);
  return rowsToObjects(data.values);
}

export async function appendRows(sheetName, rows) {
  return sheetsFetch(
    `/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) }
  );
}

/** Overwrites a single existing row (1-indexed sheet row number, including header). */
export async function updateRow(sheetName, rowNumber, rowValues) {
  return sheetsFetch(
    `/values/${encodeURIComponent(sheetName)}!A${rowNumber}:Z${rowNumber}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values: [rowValues] }) }
  );
}

/** Clears a single row's contents without shifting other rows. */
export async function clearRow(sheetName, rowNumber) {
  return sheetsFetch(`/values/${encodeURIComponent(sheetName)}!A${rowNumber}:Z${rowNumber}:clear`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function columnsFor(sheetName) {
  return SHEETS[sheetName];
}

export function objectToRow(sheetName, obj) {
  return SHEETS[sheetName].map(col => obj[col] ?? "");
}
