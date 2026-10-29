import { API_BASE_URL, API_ORIGIN, TOKEN_KEYS } from "./config";

/**
 * API client for the Django REST backend.
 *
 * - Attaches the JWT access token, transparently refreshes it once on a 401
 *   (rotating refresh tokens are persisted) and retries the request.
 * - Normalises the backend error contract
 *   `{ error: { code, message, status, details } }` into `ApiError`.
 * - Unwraps DRF pagination (`{ count, next, previous, results }`) via
 *   `fetchAll` when you need every row for dropdowns / client-side grids.
 */
export class ApiError extends Error {
  constructor(message, { code = "error", status = 0, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const listeners = new Set();
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyAuthChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener errors must not break requests */
    }
  });
}

export const tokens = {
  get access() {
    return localStorage.getItem(TOKEN_KEYS.access);
  },
  get refresh() {
    return localStorage.getItem(TOKEN_KEYS.refresh);
  },
  set(access, refresh) {
    if (access) localStorage.setItem(TOKEN_KEYS.access, access);
    if (refresh) localStorage.setItem(TOKEN_KEYS.refresh, refresh);
    notifyAuthChange();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
    notifyAuthChange();
  },
};

let refreshPromise = null;

async function rawFetch(path, { method = "GET", body, headers = {}, signal } = {}) {
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...headers,
    },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function refreshAccessToken() {
  if (!tokens.refresh) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      tokens.set(data.access, data.refresh);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function toError(res) {
  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (payload?.error) {
    return new ApiError(payload.error.message || "Request failed.", {
      code: payload.error.code || "error",
      status: payload.error.status ?? res.status,
      details: payload.error.details,
    });
  }
  const message =
    payload?.detail ||
    (payload ? JSON.stringify(payload).slice(0, 300) : res.statusText) ||
    "Request failed.";
  return new ApiError(String(message), { status: res.status, details: payload });
}

export async function api(path, options = {}) {
  let res = await rawFetch(path, options);
  if (res.status === 401 && tokens.refresh && !path.includes("/auth/token")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawFetch(path, options);
    } else {
      tokens.clear();
    }
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Return `.results` for paginated list responses, or the value as-is. */
export function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return data == null ? [] : [data];
}

/** Fetch every page of a paginated DRF list endpoint. */
export async function fetchAll(path, params = {}) {
  const out = [];
  let page = 1;
  for (;;) {
    const query = new URLSearchParams({ ...params, page: String(page), page_size: "200" });
    const data = await api(`${path}?${query.toString()}`);
    if (Array.isArray(data)) return data;
    out.push(...(data?.results ?? []));
    if (!data?.next || page > 100) break;
    page += 1;
  }
  return out;
}

async function authedBlob(path) {
  let res = await rawFetch(path, { method: "GET" });
  if (res.status === 401 && tokens.refresh) {
    if (await refreshAccessToken()) res = await rawFetch(path, { method: "GET" });
  }
  if (!res.ok) throw await toError(res);
  return res;
}

/** Authenticated blob download (PDF/CSV) triggered as a file save. */
export async function downloadFile(path, filename = "download") {
  const res = await authedBlob(path);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Open an authenticated file (e.g. a PDF) in a new tab. */
export async function openFile(path) {
  const res = await authedBlob(path);
  const blob = await res.blob();
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Absolute API URL — used for checkout return links. */
export function apiUrl(path) {
  return `${API_ORIGIN || window.location.origin}${API_BASE_URL}${path}`;
}

export const qs = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
  });
  const s = query.toString();
  return s ? `?${s}` : "";
};

