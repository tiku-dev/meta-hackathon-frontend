/** Display formatting helpers (amounts arrive as decimal strings). */

export const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function formatMoney(value, currency = "XAF") {
  if (value === null || value === undefined || value === "") return "—";
  const n = num(value);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
  return `${formatted} ${currency || "XAF"}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US").format(num(value));
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":");
  if (h === undefined) return String(value);
  const d = new Date();
  d.setHours(Number(h), Number(m || 0), 0, 0);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "in 12 days" / "3 days overdue" style deadline helper. */
export function daysLabel(value) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export const humanize = (value) =>
  String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

/** Convert local <input type="datetime-local"> value to an ISO string. */
export const toISO = (value) => (value ? new Date(value).toISOString() : null);

/** Convert an API datetime to a datetime-local input value. */
export function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
