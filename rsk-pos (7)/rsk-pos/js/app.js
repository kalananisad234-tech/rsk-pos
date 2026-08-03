import { CONFIG } from "./config.js";
import { initAuth, requestSignIn, getCurrentUser, signOut } from "./auth.js";
import { ensureSchema } from "./sheetsApi.js";
import { loadAll } from "./store.js";
import { registerRoute, initRouter, navigate } from "./router.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderPOS } from "./views/pos.js";
import { renderInventory } from "./views/inventory.js";
import { renderSalesHistory } from "./views/salesHistory.js";
import { renderCustomers } from "./views/customers.js";
import { renderReports } from "./views/reports.js";
import { renderSettings } from "./views/settings.js";

const NAV_ITEMS = [
  { route: "dashboard", label: "Dashboard" },
  { route: "pos", label: "New sale" },
  { route: "inventory", label: "Inventory" },
  { route: "sales", label: "Sales history" },
  { route: "customers", label: "Customers" },
  { route: "reports", label: "Reports" },
  { route: "settings", label: "Settings" }
];

const appEl = document.getElementById("app");

function showLogin(message) {
  appEl.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <img src="assets/logo.png" alt="${CONFIG.SHOP_NAME}" class="login-logo" />
        <h1>${CONFIG.SHOP_NAME}</h1>
        <p class="login-tagline">Point of sale</p>
        ${message ? `<p class="login-error">${message}</p>` : ""}
        <button class="btn btn-primary btn-block" id="signin-btn">Sign in with Google</button>
      </div>
    </div>
  `;
  document.getElementById("signin-btn").addEventListener("click", requestSignIn);
}

function showConfigWarning() {
  const placeholders = [
    CONFIG.GOOGLE_CLIENT_ID.includes("YOUR_"),
    CONFIG.SPREADSHEET_ID.includes("YOUR_")
  ];
  if (placeholders.some(Boolean)) {
    appEl.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <img src="assets/logo.png" alt="${CONFIG.SHOP_NAME}" class="login-logo" />
          <h1>Almost there</h1>
          <p>This app hasn't been configured yet. Open <code>js/config.js</code> and fill in your
          <strong>GOOGLE_CLIENT_ID</strong> and <strong>SPREADSHEET_ID</strong>. See README.md for
          step-by-step setup.</p>
        </div>
      </div>
    `;
    return true;
  }
  return false;
}

async function showApp() {
  const user = getCurrentUser();
  appEl.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="assets/logo.png" alt="" class="sidebar-logo" />
          <span>${CONFIG.SHOP_NAME}</span>
        </div>
        <nav class="nav">
          ${NAV_ITEMS.map(
            item => `<a href="#/${item.route}" class="nav-link" data-route="${item.route}">${item.label}</a>`
          ).join("")}
        </nav>
        <div class="sidebar-user">
          <img src="${user.picture}" alt="" class="user-avatar" onerror="this.style.display='none'" />
          <div class="user-info">
            <span class="user-name">${user.name}</span>
            <span class="user-email">${user.email}</span>
          </div>
          <button class="btn btn-sm" id="signout-btn">Sign out</button>
        </div>
      </aside>
      <main class="main" id="view-root"></main>
    </div>
  `;

  document.getElementById("signout-btn").addEventListener("click", signOut);

  registerRoute("dashboard", renderDashboard);
  registerRoute("pos", renderPOS);
  registerRoute("inventory", renderInventory);
  registerRoute("sales", renderSalesHistory);
  registerRoute("customers", renderCustomers);
  registerRoute("reports", renderReports);
  registerRoute("settings", renderSettings);

  initRouter(document.getElementById("view-root"));
}

function waitForGoogleIdentity(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Google sign-in script failed to load."));
      setTimeout(poll, 100);
    })();
  });
}

async function boot() {
  if (showConfigWarning()) return;

  appEl.innerHTML = `<div class="loading-screen">Loading Google sign-in…</div>`;

  try {
    await waitForGoogleIdentity();
  } catch (err) {
    appEl.innerHTML = `<div class="login-screen"><div class="login-card"><h1>Connection problem</h1><p>${err.message} Check your internet connection and reload the page.</p></div></div>`;
    return;
  }

  initAuth(
    async () => {
      appEl.innerHTML = `<div class="loading-screen">Syncing with your Google Sheet…</div>`;
      try {
        await ensureSchema();
        await loadAll();
        await showApp();
      } catch (err) {
        showLogin(`Signed in, but couldn't load data: ${err.message}`);
      }
    },
    message => showLogin(message)
  );

  // If GIS hasn't already resolved a stored session, show the sign-in button.
  setTimeout(() => {
    if (appEl.querySelector(".loading-screen")) showLogin();
  }, 800);
}

window.addEventListener("DOMContentLoaded", boot);
