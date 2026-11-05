/**
 * Runtime configuration.
 *
 * API base:
 * - When VITE_API_BASE_URL is provided, use it.
 * - In production builds, default to the deployed backend URL:
 *   "https://meta-hackathon-backend-wine.vercel.app/api"
 * - In development, default to "/api" (proxied to 127.0.0.1:8000 by Vite).
 */
const DEFAULT_API_BASE_URL = import.meta.env
  ? "https://meta-hackathon-backend-wine.vercel.app/api"
  : "/api";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
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
