import { state, updateSettings } from "../store.js";
import { CONFIG } from "../config.js";
import { escapeHtml } from "../router.js";
import { requirePassword } from "../security.js";

export async function renderSettings(root) {
  const ok = await requirePassword("open Settings");
  if (!ok) {
    root.innerHTML = `<div class="page-header"><h1>Settings</h1></div><div class="panel"><p class="empty">Access cancelled.</p></div>`;
    return;
  }
  const s = state.settings;
  root.innerHTML = `
    <div class="page-header"><h1>Settings</h1></div>

    <div class="panel">
      <form id="settings-form">
        <label class="field"><span>Shop name</span><input class="input" name="ShopName" value="${escapeHtml(s.ShopName || "")}" /></label>
        <label class="field"><span>Address</span><input class="input" name="ShopAddress" value="${escapeHtml(s.ShopAddress || "")}" /></label>
        <label class="field"><span>Phone</span><input class="input" name="ShopPhone" value="${escapeHtml(s.ShopPhone || "")}" /></label>
        <label class="field"><span>Registration No.</span><input class="input" name="RegNo" value="${escapeHtml(s.RegNo || "")}" /></label>
        <label class="field"><span>"Since" year</span><input class="input" name="SinceYear" value="${escapeHtml(s.SinceYear || "")}" /></label>
        <label class="field"><span>Tagline (top-right ribbon)</span><input class="input" name="Tagline" value="${escapeHtml(s.Tagline || "")}" /></label>
        <label class="field"><span>Currency symbol</span><input class="input" name="Currency" value="${escapeHtml(s.Currency || "")}" /></label>
        <label class="field"><span>Tax rate (%)</span><input class="input" name="TaxRate" type="number" step="0.01" min="0" value="${escapeHtml(s.TaxRate || "0")}" /></label>
        <label class="field"><span>Low stock threshold (default for new products)</span><input class="input" name="LowStockThreshold" type="number" step="1" min="0" value="${escapeHtml(s.LowStockThreshold || "3")}" /></label>
        <label class="field"><span>Receipt footer text</span><input class="input" name="ReceiptFooter" value="${escapeHtml(s.ReceiptFooter || "")}" /></label>
        <label class="field"><span>Day revenue target</span><input class="input" name="DayTarget" type="number" step="0.01" min="0" value="${escapeHtml(s.DayTarget || "0")}" /></label>
        <label class="field"><span>Weekly revenue target</span><input class="input" name="WeeklyTarget" type="number" step="0.01" min="0" value="${escapeHtml(s.WeeklyTarget || "0")}" /></label>
        <label class="field"><span>Monthly revenue target</span><input class="input" name="MonthlyTarget" type="number" step="0.01" min="0" value="${escapeHtml(s.MonthlyTarget || "0")}" /></label>
        <button type="submit" class="btn btn-primary">Save settings</button>
        <p id="save-confirmation" class="save-confirmation"></p>
      </form>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Security</h2></div>
      <p class="hint">When enabled, staff must enter this password to open Settings or make Inventory changes (add, edit, remove products).</p>
      <form id="security-form">
        <label class="field field-checkbox">
          <input type="checkbox" name="PasswordEnabled" ${s.PasswordEnabled === "TRUE" ? "checked" : ""} />
          <span>Require password for Settings &amp; Inventory changes</span>
        </label>
        <label class="field"><span>Password</span><input class="input" name="SettingsPassword" type="text" placeholder="Leave as-is to keep current password" value="${escapeHtml(s.SettingsPassword || "")}" /></label>
        <button type="submit" class="btn btn-primary">Save security settings</button>
        <p id="security-confirmation" class="save-confirmation"></p>
      </form>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Staff with access</h2></div>
      <p class="hint">Managed in <code>config.js</code> → <code>ALLOWED_EMAILS</code>. Redeploy after changing it.</p>
      <ul class="staff-list">
        ${CONFIG.ALLOWED_EMAILS.map(e => `<li class="mono">${escapeHtml(e)}</li>`).join("")}
      </ul>
    </div>
  `;

  root.querySelector("#security-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      PasswordEnabled: form.get("PasswordEnabled") ? "TRUE" : "FALSE",
      SettingsPassword: form.get("SettingsPassword") || ""
    };
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await updateSettings(payload);
      root.querySelector("#security-confirmation").textContent = "Saved.";
    } catch (err) {
      alert(`Could not save: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  root.querySelector("#settings-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await updateSettings(payload);
      root.querySelector("#save-confirmation").textContent = "Saved.";
    } catch (err) {
      alert(`Could not save settings: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save settings";
    }
  });
}
