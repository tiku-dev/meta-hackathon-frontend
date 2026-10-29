/**
 * Runtime configuration.
 *
 * API base: by default the app talks to the Vite dev proxy (same-origin
 * `/api`), which forwards to the Django backend on 127.0.0.1:8000.
 * Set VITE_API_BASE_URL (e.g. http://127.0.0.1:8000/api) to bypass the proxy.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace(/\/+$/, "");

/** Origin used for absolute download URLs / opening statements. */
export const API_ORIGIN = API_BASE_URL.startsWith("http")
  ? API_BASE_URL.replace(/\/api\/?$/, "")
  : "";

export const UNIVERSITY_NAME =
  import.meta.env.VITE_UNIVERSITY_NAME || "University Portal";

export const TIMEZONE_LABEL = "Africa/Douala";

export const TOKEN_KEYS = {
  access: "sms.access_token",
  refresh: "sms.refresh_token",
};

export const DEMO_ACCOUNTS = [
  { identifier: "admin@demo.edu", role: "Admin" },
  { identifier: "finance@demo.edu", role: "Finance officer" },
  { identifier: "registrar@demo.edu", role: "Registrar" },
  { identifier: "hod@demo.edu", role: "Head of Department" },
  { identifier: "lecturer@demo.edu", role: "Lecturer" },
  { identifier: "UB26-CSC-0002", role: "Student (matricule UB26-CSC-0002)" },
];
export const DEMO_PASSWORD = "DemoPass123!";
