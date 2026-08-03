// ============================================================
// RSK POS — Configuration
// Fill in the values below. See README.md for step-by-step
// instructions on where each of these comes from.
// ============================================================

export const CONFIG = {
  // From Google Cloud Console → APIs & Services → Credentials
  // → OAuth 2.0 Client IDs → your Web application client
  GOOGLE_CLIENT_ID: "53761110870-kv9qeg1kpples2ac7t3d2lbarev07059.apps.googleusercontent.com",

  // The ID from your Google Sheet's URL:
  // https://docs.google.com/spreadsheets/d/  >>THIS_PART<<  /edit
  SPREADSHEET_ID: "1eDj5FIu4b1j-wTkObJe9jmXrOWu9OZbC5ko2eI7J_0A",

  // Only these Google accounts will be allowed to sign in and use
  // the till. Add every cashier / staff email that needs access.
  ALLOWED_EMAILS: [
    "kalananisad234@gmail.com"
    "rskcomshop@gmail.com"
  ],

  // Shown on receipts, the dashboard, and the browser tab.
  SHOP_NAME: "RSK Computers & Gadgets",
  SHOP_ADDRESS: "182/4, Kirindiwela Road, Ettiehelgotla, Weliweriya",
  SHOP_PHONE: "0771 843 148 / 0332 254 744",
  REG_NO: "WR12708",
  SINCE_YEAR: "2008",
  TAGLINE: "Your IT Solution",
  RECEIPT_FOOTER: "Thank you for shopping with us!",

  // Currency symbol used everywhere in the app.
  CURRENCY: "Rs.",

  // Default tax rate applied to sales (%). Can be changed later
  // in the Settings screen — that value overrides this one.
  DEFAULT_TAX_RATE: 0,

  // Stock level at or below which a product is flagged "low stock".
  DEFAULT_LOW_STOCK_THRESHOLD: 3
};
