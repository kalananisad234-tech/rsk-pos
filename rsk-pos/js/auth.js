// ============================================================
// RSK POS — Google Authentication
// Uses Google Identity Services (GIS) to sign the cashier in
// with their Google account and obtain an access token that is
// allowed to read/write the shop's Google Sheet.
// ============================================================

import { CONFIG } from "./config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");

const TOKEN_STORAGE_KEY = "rskpos_token";

let tokenClient = null;
let currentUser = null; // { email, name, picture }
let onSignedIn = null;

function loadStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.access_token || !data.expires_at) return null;
    if (Date.now() >= data.expires_at) return null;
    return data;
  } catch {
    return null;
  }
}

function storeToken(tokenResponse) {
  const expires_at = Date.now() + (tokenResponse.expires_in - 60) * 1000;
  localStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({ access_token: tokenResponse.access_token, expires_at })
  );
}

export function getAccessToken() {
  const stored = loadStoredToken();
  return stored ? stored.access_token : null;
}

export function getCurrentUser() {
  return currentUser;
}

export function signOut() {
  const token = getAccessToken();
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  currentUser = null;
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
  location.reload();
}

async function fetchUserInfo(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Could not fetch Google profile.");
  return res.json();
}

function isAllowed(email) {
  return CONFIG.ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(
    (email || "").toLowerCase()
  );
}

/**
 * Initializes the Google Identity Services token client.
 * @param {(user: object) => void} onSuccess called once a signed-in,
 *   allow-listed user is confirmed.
 * @param {(message: string) => void} onError called with a human
 *   readable error message.
 */
export function initAuth(onSuccess, onError) {
  onSignedIn = onSuccess;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: async tokenResponse => {
      try {
        if (tokenResponse.error) {
          onError(describeAuthError(tokenResponse.error));
          return;
        }
        storeToken(tokenResponse);
        const profile = await fetchUserInfo(tokenResponse.access_token);
        if (!isAllowed(profile.email)) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          onError(
            `${profile.email} isn't on the staff list for this till. Ask an admin to add this email to ALLOWED_EMAILS in config.js.`
          );
          return;
        }
        currentUser = {
          email: profile.email,
          name: profile.name || profile.email,
          picture: profile.picture || ""
        };
        onSignedIn(currentUser);
      } catch (err) {
        onError(err.message || "Sign-in failed. Please try again.");
      }
    }
  });

  // If a valid token is already stored, try to resume the session
  // silently (confirms the allow-list without a fresh popup).
  const stored = loadStoredToken();
  if (stored) {
    fetchUserInfo(stored.access_token)
      .then(profile => {
        if (isAllowed(profile.email)) {
          currentUser = {
            email: profile.email,
            name: profile.name || profile.email,
            picture: profile.picture || ""
          };
          onSignedIn(currentUser);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY));
  }
}

export function requestSignIn() {
  if (!tokenClient) {
    throw new Error("Auth not initialized yet.");
  }
  tokenClient.requestAccessToken();
}

function describeAuthError(code) {
  if (code === "access_denied") {
    return "Sign-in was cancelled.";
  }
  return `Google sign-in error: ${code}`;
}
