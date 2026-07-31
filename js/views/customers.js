import { state, addCustomer, updateCustomer } from "../store.js";
import { escapeHtml } from "../router.js";

export async function renderCustomers(root) {
  draw(root);
}

function draw(root) {
  root.innerHTML = `
    <div class="page-header">
      <h1>Customers</h1>
      <button class="btn btn-primary" id="add-customer-btn">+ Add customer</button>
    </div>
    <div class="panel">
      <table class="table">
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${
            state.customers.length === 0
              ? `<tr><td colspan="5"><p class="empty">No customers saved yet.</p></td></tr>`
              : state.customers
                  .map(
                    c => `<tr>
                <td>${escapeHtml(c.Name)}</td>
                <td class="mono">${escapeHtml(c.Phone)}</td>
                <td>${escapeHtml(c.Email)}</td>
                <td>${escapeHtml(c.Notes)}</td>
                <td><button class="btn btn-sm" data-edit="${c.ID}">Edit</button></td>
              </tr>`
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
    <div id="customer-modal"></div>
  `;

  root.querySelector("#add-customer-btn").addEventListener("click", () => openModal(root, null));
  root.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openModal(root, state.customers.find(c => c.ID === btn.dataset.edit)))
  );
}

function openModal(root, customer) {
  const modal = root.querySelector("#customer-modal");
  const isEdit = !!customer;
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h2>${isEdit ? "Edit customer" : "Add customer"}</h2>
        <form id="customer-form">
          <label class="field"><span>Name</span><input class="input" name="Name" required value="${isEdit ? escapeHtml(customer.Name) : ""}" /></label>
          <label class="field"><span>Phone</span><input class="input" name="Phone" value="${isEdit ? escapeHtml(customer.Phone) : ""}" /></label>
          <label class="field"><span>Email</span><input class="input" name="Email" type="email" value="${isEdit ? escapeHtml(customer.Email) : ""}" /></label>
          <label class="field"><span>Notes</span><input class="input" name="Notes" value="${isEdit ? escapeHtml(customer.Notes) : ""}" /></label>
          <div class="modal-actions">
            <button type="button" class="btn" id="cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Add customer"}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modal.querySelector("#cancel-modal").addEventListener("click", () => (modal.innerHTML = ""));
  modal.querySelector("#customer-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = { Name: form.get("Name"), Phone: form.get("Phone"), Email: form.get("Email"), Notes: form.get("Notes") };
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      if (isEdit) {
        await updateCustomer({ ...customer, ...payload });
      } else {
        await addCustomer(payload);
      }
      modal.innerHTML = "";
      draw(root);
    } catch (err) {
      alert(`Could not save: ${err.message}`);
      submitBtn.disabled = false;
    }
  });
}
