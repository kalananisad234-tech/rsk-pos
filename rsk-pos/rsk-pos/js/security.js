// ============================================================
// RSK POS — Password gate
// When enabled in Settings, this prompts for the shop password
// before letting someone into Settings or make Inventory changes.
// This is a simple deterrent for shop-floor staff, not
// cryptographic security — the password is stored in plain text
// in the spreadsheet's Settings tab.
// ============================================================

import { passwordProtectionEnabled, checkPassword } from "./store.js";

/**
 * Resolves true if the action should proceed (either password
 * protection is off, or the person entered the right password).
 * Resolves false if they cancelled or got it wrong.
 */
export function requirePassword(actionLabel = "continue") {
  if (!passwordProtectionEnabled()) return Promise.resolve(true);

  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <h2>Password required</h2>
        <p class="hint">Enter the shop password to ${actionLabel}.</p>
        <form id="pw-form">
          <label class="field"><span>Password</span><input class="input" type="password" id="pw-input" autofocus /></label>
          <p class="login-error" id="pw-error" style="display:none;">Incorrect password.</p>
          <div class="modal-actions">
            <button type="button" class="btn" id="pw-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Continue</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#pw-input");
    input.focus();

    function finish(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector("#pw-cancel").addEventListener("click", () => finish(false));
    overlay.querySelector("#pw-form").addEventListener("submit", e => {
      e.preventDefault();
      if (checkPassword(input.value)) {
        finish(true);
      } else {
        overlay.querySelector("#pw-error").style.display = "block";
        input.value = "";
        input.focus();
      }
    });
  });
}
