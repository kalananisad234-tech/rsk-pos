// ============================================================
// RSK POS — Tiny hash router
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

export function navigate(name) {
  location.hash = `#/${name}`;
}

function currentRoute() {
  const hash = location.hash.replace(/^#\//, "");
  return routes[hash] ? hash : "dashboard";
}

async function render() {
  const route = currentRoute();
  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.route === route);
  });
  rootEl.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    await routes[route](rootEl);
  } catch (err) {
    rootEl.innerHTML = `<div class="error-banner">Something went wrong: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
