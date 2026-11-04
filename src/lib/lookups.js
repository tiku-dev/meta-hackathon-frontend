import { useEffect, useState } from "react";
import { fetchAll } from "./api";

/**
 * Small module-level cache for reference data (units, programs, levels,
 * years, semesters, courses, lecturers…) used by selects and ID→label maps.
 * Loads once per resource; call `invalidateLookups()` after admin edits.
 */
const cache = new Map();
const inflight = new Map();

export const LOOKUP_PATHS = {
  units: "/admin/academic-units/",
  programs: "/admin/programs/",
  levels: "/admin/levels/",
  years: "/admin/academic-years/",
  semesters: "/admin/semesters/",
  courses: "/admin/courses/",
  programCourses: "/admin/program-courses/",
  lecturers: "/admin/lecturers/",
  students: "/admin/students/",
  gradingPolicies: "/admin/grading-policies/",
  feeSchedules: "/admin/fee-schedules/",
};

export function loadLookup(key) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const promise = fetchAll(LOOKUP_PATHS[key])
    .then((rows) => {
      cache.set(key, rows);
      inflight.delete(key);
      return rows;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

export function invalidateLookups(...keys) {
  (keys.length ? keys : Object.keys(LOOKUP_PATHS)).forEach((k) => cache.delete(k));
}

/** React hook: `const units = useLookup("units")` → array (empty while loading). */
export function useLookup(key) {
  const [rows, setRows] = useState(() => cache.get(key) || []);
  useEffect(() => {
    let alive = true;
    loadLookup(key)
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [key]);
  return rows;
}

export function labelById(rows, id, fallback = "—") {
  if (!Array.isArray(rows)) return id == null || id === "" ? fallback : `#${id}`;
  if (id === null || id === undefined || id === "") return fallback;
  const row = rows.find((r) => String(r.id) === String(id));
  if (!row) return `#${id}`;
  if (row.program_name && row.label) {
    return `${row.program_name} — ${row.label}`;
  }
  if (row.academic_year_label && row.semester_type) {
    return `${row.academic_year_label} · ${row.semester_type}`;
  }
  return row.name || row.label || row.code || row.full_name || row.title || `#${row.id}`;
}
