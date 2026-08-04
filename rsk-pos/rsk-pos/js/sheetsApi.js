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
  Sales: [
    "ID", "DateTime", "CustomerName", "CustomerPhone", "ItemsJSON", "Subtotal", "Discount", "Tax", "Total",
    "PaymentMethod", "CashierEmail", "HasWarranty", "WarrantyNo", "WarrantyTillDate", "WarrantyNotes"
  ],
  Customers: ["ID", "Name", "Phone", "Email", "Notes"],
  Settings: ["Key", "Value"]
};

function columnLetter(index) {
  // 0-based column index -> spreadsheet column letters (A, B, ... Z, AA, AB, ...)
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Reads just the header row of a sheet. */
async function getHeaderRow(sheetName) {
  const data = await sheetsFetch(`/values/${encodeURIComponent(sheetName)}!1:1`);
  return (data.values && data.values[0]) || [];
}

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

  // For sheets that already existed, make sure any newly-introduced
  // columns (e.g. warranty fields added in a later version) get added
  // to the end of the header row so existing spreadsheets stay in sync.
  for (const name of Object.keys(SHEETS)) {
    if (missing.includes(name) || name === "Settings") continue;
    await ensureColumns(name);
  }
}

async function ensureColumns(sheetName) {
  const header = await getHeaderRow(sheetName);
  const expected = SHEETS[sheetName];
  const toAdd = expected.filter(col => !header.includes(col));
  if (toAdd.length === 0) return;
  const startCol = columnLetter(header.length);
  const endCol = columnLetter(header.length + toAdd.length - 1);
  await sheetsFetch(`/values/${encodeURIComponent(sheetName)}!${startCol}1:${endCol}1?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [toAdd] })
  });
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
    ["LowStockThreshold", String(CONFIG.DEFAULT_LOW_STOCK_THRESHOLD)],
    ["DayTarget", String(CONFIG.DEFAULT_DAY_TARGET)],
    ["MonthlyTarget", String(CONFIG.DEFAULT_MONTHLY_TARGET)],
    ["PasswordEnabled", "FALSE"],
    ["SettingsPassword", ""]
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

/** Appends a single row and returns its 1-indexed sheet row number, read from the API's own response (avoids assuming rows always land at the end). */
export async function appendSingleRow(sheetName, rowValues) {
  const res = await appendRows(sheetName, [rowValues]);
  const range = res.updates?.updatedRange || "";
  const match = range.match(/![A-Z]+(\d+):/);
  return match ? Number(match[1]) : null;
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
