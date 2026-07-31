import { state, updateSettings } from "../store.js";
import { CONFIG } from "../config.js";
import { escapeHtml } from "../router.js";

export async function renderSettings(root) {
  const s = state.settings;
  root.innerHTML = `
    <div class="page-header"><h1>Settings</h1></div>

    <div class="panel">
      <form id="settings-form">
        <label class="field"><span>Shop name</span><input class="input" name="ShopName" value="${escapeHtml(s.ShopName || "")}" /></label>
        <label class="field"><span>Address</span><input class="input" name="ShopAddress" value="${escapeHtml(s.ShopAddress || "")}" /></label>
        <label class="field"><span>Phone</span><input class="input" name="ShopPhone" value="${escapeHtml(s.ShopPhone || "")}" /></label>
        <label class="field"><span>Currency symbol</span><input class="input" name="Currency" value="${escapeHtml(s.Currency || "")}" /></label>
        <label class="field"><span>Tax rate (%)</span><input class="input" name="TaxRate" type="number" step="0.01" min="0" value="${escapeHtml(s.TaxRate || "0")}" /></label>
        <label class="field"><span>Low stock threshold (default for new products)</span><input class="input" name="LowStockThreshold" type="number" step="1" min="0" value="${escapeHtml(s.LowStockThreshold || "3")}" /></label>
        <label class="field"><span>Receipt footer text</span><input class="input" name="ReceiptFooter" value="${escapeHtml(s.ReceiptFooter || "")}" /></label>
        <button type="submit" class="btn btn-primary">Save settings</button>
        <p id="save-confirmation" class="save-confirmation"></p>
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
