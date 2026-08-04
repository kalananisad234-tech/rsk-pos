import { state, formatMoney, addProduct, updateProduct, deactivateProduct } from "../store.js";
import { escapeHtml } from "../router.js";
import { requirePassword } from "../security.js";

export async function renderInventory(root) {
  draw(root);
}

function draw(root, editing = null) {
  const products = state.products.filter(p => p.Active);

  root.innerHTML = `
    <div class="page-header">
      <h1>Inventory</h1>
      <button class="btn btn-primary" id="add-product-btn">+ Add product</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr><th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th>Alert at</th><th></th></tr>
        </thead>
        <tbody>
          ${
            products.length === 0
              ? `<tr><td colspan="8"><p class="empty">No products yet. Add your first one.</p></td></tr>`
              : products
                  .map(
                    p => `<tr>
                <td class="mono">${escapeHtml(p.SKU)}</td>
                <td>${escapeHtml(p.Name)}</td>
                <td>${escapeHtml(p.Category)}</td>
                <td class="mono">${formatMoney(p.CostPrice)}</td>
                <td class="mono">${formatMoney(p.SellPrice)}</td>
                <td class="mono ${p.Stock <= p.LowStockAt ? "text-warn" : ""}">${p.Stock}</td>
                <td class="mono">${p.LowStockAt}</td>
                <td class="table-actions">
                  <button class="btn btn-sm" data-edit="${p.ID}">Edit</button>
                  <button class="btn btn-sm btn-danger-ghost" data-remove="${p.ID}">Remove</button>
                </td>
              </tr>`
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>

    <div id="product-modal"></div>
  `;

  root.querySelector("#add-product-btn").addEventListener("click", async () => {
    if (await requirePassword("add a product")) openModal(root, null);
  });
  root.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (await requirePassword("edit a product")) openModal(root, state.products.find(p => p.ID === btn.dataset.edit));
    })
  );
  root.querySelectorAll("[data-remove]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!(await requirePassword("remove a product"))) return;
      if (!confirm("Remove this product from the active catalog? Past sales keep their record.")) return;
      const product = state.products.find(p => p.ID === btn.dataset.remove);
      await deactivateProduct(product);
      draw(root);
    })
  );

  if (editing !== null) openModal(root, editing);
}

function openModal(root, product) {
  const modal = root.querySelector("#product-modal");
  const isEdit = !!product;
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h2>${isEdit ? "Edit product" : "Add product"}</h2>
        <form id="product-form">
          <label class="field"><span>SKU</span><input class="input" name="SKU" required value="${isEdit ? escapeHtml(product.SKU) : ""}" /></label>
          <label class="field"><span>Name</span><input class="input" name="Name" required value="${isEdit ? escapeHtml(product.Name) : ""}" /></label>
          <label class="field"><span>Category</span><input class="input" name="Category" value="${isEdit ? escapeHtml(product.Category) : ""}" /></label>
          <label class="field"><span>Cost price</span><input class="input" name="CostPrice" type="number" step="0.01" min="0" required value="${isEdit ? product.CostPrice : ""}" /></label>
          <label class="field"><span>Sell price</span><input class="input" name="SellPrice" type="number" step="0.01" min="0" required value="${isEdit ? product.SellPrice : ""}" /></label>
          <label class="field"><span>Stock on hand</span><input class="input" name="Stock" type="number" step="1" min="0" required value="${isEdit ? product.Stock : "0"}" /></label>
          <label class="field"><span>Low stock alert at</span><input class="input" name="LowStockAt" type="number" step="1" min="0" value="${isEdit ? product.LowStockAt : "3"}" /></label>
          <div class="modal-actions">
            <button type="button" class="btn" id="cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Add product"}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modal.querySelector("#cancel-modal").addEventListener("click", () => (modal.innerHTML = ""));
  modal.querySelector("#product-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      SKU: form.get("SKU"),
      Name: form.get("Name"),
      Category: form.get("Category"),
      CostPrice: Number(form.get("CostPrice")),
      SellPrice: Number(form.get("SellPrice")),
      Stock: Number(form.get("Stock")),
      LowStockAt: Number(form.get("LowStockAt")) || 0
    };
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    try {
      if (isEdit) {
        await updateProduct({ ...product, ...payload });
      } else {
        await addProduct(payload);
      }
      modal.innerHTML = "";
      draw(root);
    } catch (err) {
      alert(`Could not save: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Save changes" : "Add product";
    }
  });
}
