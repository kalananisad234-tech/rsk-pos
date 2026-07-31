# RSK Computers & Gadgets — POS

A point-of-sale web app for RSK Computers & Gadgets. Staff sign in with
their Google account, and every product, sale, and customer is stored
in your own Google Sheet — no other database or server required.

Plain HTML/CSS/JS. No build step, no framework, nothing to `npm install`.

---

## What you get

- **Dashboard** — today's revenue, transaction count, low-stock alerts, recent sales
- **New sale (POS)** — search products, build a cart, apply a discount, take payment, print a receipt
- **Inventory** — add/edit products, track stock, low-stock threshold per item
- **Sales history** — browse and filter past sales by date, view line-item detail
- **Customers** — a simple customer book
- **Reports** — revenue chart and top-selling products over a date range
- **Settings** — shop name, address, phone, currency, tax rate, receipt footer
- **Google Sign-In** — only the staff emails you list can access the till
- **Google Sheets storage** — your data lives in a spreadsheet you own and can open directly any time

---

## 1. Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new, blank spreadsheet. Name it something like "RSK POS Data".
2. Copy the **Spreadsheet ID** out of the URL:
   ```
   https://docs.google.com/spreadsheets/d/  1AbCdEfGhIjKlMnOpQrStUvWxYz  /edit
                                             ^^^^^^^^^^^^^^^^^^^^^^^^^^ this part
   ```
3. Leave the sheet otherwise empty — the app creates the tabs it needs (`Products`, `Sales`, `Customers`, `Settings`) and writes their headers automatically the first time it runs.

## 2. Create a Google Cloud project & OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or pick an existing one).
2. **Enable the API**: go to *APIs & Services → Library*, search for **Google Sheets API**, and click **Enable**.
3. **Configure the consent screen**: go to *APIs & Services → OAuth consent screen*.
   - User type: **External** (unless you're on Google Workspace and want Internal).
   - Fill in the app name (e.g. "RSK POS"), your email, and save.
   - Under **Audience/Test users**, add every staff Google account that should be able to use the till while the app is in "Testing" status (this is fine for internal use — you don't need Google's app verification for a private tool like this, up to 100 test users).
4. **Create credentials**: go to *APIs & Services → Credentials → Create Credentials → OAuth client ID*.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add the exact URL you'll host the app at, e.g.:
     - `http://localhost:8080` (for local testing)
     - `https://your-username.github.io` (if using GitHub Pages)
     - `https://your-app.vercel.app` (if using Vercel)
   - No redirect URI is needed.
   - Click **Create** and copy the **Client ID** (looks like `123456-abc.apps.googleusercontent.com`).

## 3. Configure the app

Open `js/config.js` and fill in:

```js
GOOGLE_CLIENT_ID: "your-client-id.apps.googleusercontent.com",
SPREADSHEET_ID: "your-spreadsheet-id",
ALLOWED_EMAILS: ["you@gmail.com", "cashier2@gmail.com"],
```

Also review `SHOP_NAME`, `CURRENCY`, and the other defaults — these seed the
Settings tab the first time the app runs (you can also change them later
from the in-app Settings page).

## 4. Host it

Any static file host works, since this is just HTML/CSS/JS. A few options:

**Quick local test:**
```bash
cd rsk-pos
npx serve .
# open the printed http://localhost:... URL
```
(Remember to add that exact localhost URL as an Authorized JavaScript origin in step 2.)

**GitHub Pages:**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → deploy from the `main` branch.
3. Add the resulting `https://your-username.github.io/repo-name` URL as an Authorized JavaScript origin (and update it if GitHub Pages serves from a subpath).

**Netlify / Vercel:** drag-and-drop the folder or connect the repo; both give you a URL instantly — add that URL as an Authorized JavaScript origin.

## 5. First run

1. Open the hosted URL and click **Sign in with Google**.
2. Approve the permissions (it only asks for access to Sheets and your basic profile — used to check your email against the allow-list).
3. The app will automatically create the `Products`, `Sales`, `Customers`, and `Settings` tabs in your spreadsheet.
4. Go to **Inventory** and add your first products, then head to **New sale** to ring something up.

---

## How data is stored

Everything lives in the spreadsheet you created — you can open it directly
in Google Sheets any time to inspect or back up your data:

| Tab | Holds |
|---|---|
| `Products` | SKU, name, category, cost/sell price, stock, low-stock threshold |
| `Sales` | One row per sale, with line items stored as JSON in one cell |
| `Customers` | Name, phone, email, notes |
| `Settings` | Shop name/address/phone, currency, tax rate, receipt footer |

There is no separate backend or database — the browser talks straight to
the Google Sheets API using the signed-in user's own permissions.

## Notes & limits

- **Access control** is enforced by the `ALLOWED_EMAILS` list in `config.js` — anyone with a Google account can *attempt* to sign in, but only listed emails get past the check. Keep that list current and redeploy after editing it.
- **Concurrent edits**: if two cashiers ring up a sale on the same product at the exact same moment, the last write wins on that product's stock count — fine for a single small shop, but worth knowing.
- **Offline use isn't supported** — the app needs an internet connection to reach Google Sheets.
- To reset everything, just delete the tabs in your spreadsheet; the app recreates them (empty) next time it loads.
