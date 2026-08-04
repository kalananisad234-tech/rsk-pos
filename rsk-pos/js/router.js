// ============================================================
// RSK POS — Tiny hash router
// Supports an optional trailing parameter, e.g. "#/pos/Printing",
// passed as the second argument to the route's render function.
// ============================================================

const routes = {};
let rootEl = null;

export function registerRoute(name, renderFn) {
  routes[name] = renderFn;
}

export function initRouter(root) {
  rootEl = root;
  window.addEventListener("hashchange", render);
  render();
}

export function navigate(name, param) {
  location.hash = param ? `#/${name}/${encodeURIComponent(param)}` : `#/${name}`;
}

function parseHash() {
  const parts = location.hash.replace(/^#\//, "").split("/");
  const route = routes[parts[0]] ? parts[0] : "dashboard";
  const param = parts[1] ? decodeURIComponent(parts[1]) : undefined;
  return { route, param };
}

async function render() {
  const { route, param } = parseHash();
  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.route === route);
  });
  rootEl.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    await routes[route](rootEl, param);
  } catch (err) {
    rootEl.innerHTML = `<div class="error-banner">Something went wrong: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
