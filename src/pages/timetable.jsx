import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { useLookup } from "../lib/lookups";
import { formatDate, formatTime } from "../lib/format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Weekly timetable grid.
 * Students default to their own program/level (the API scopes it anyway);
 * staff can filter by program, level, semester or lecturer.
 */
export function TimetablePage() {
  const auth = useAuth();
  const programs = useLookup("programs");
  const levels = useLookup("levels");
  const semesters = useLookup("semesters");
  const lecturers = useLookup("lecturers");
  const canFilter = !auth.has("student") || auth.isStaff || auth.has("lecturer", "hod");

  const [filters, setFilters] = useState({ program: "", level: "", semester: "", lecturer: "" });
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "")),
  ).toString();
  const timetable = useApi(`/timetable${query ? `?${query}` : ""}`, { deps: [query] });
  const sessions = useMemo(() => timetable.data || [], [timetable.data]);

  const { byDay, dated } = useMemo(() => {
    const map = new Map(DAYS.map((d, i) => [i, []]));
    const datedList = [];
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      if (s.weekday !== null && s.weekday !== undefined) {
        if (!map.has(s.weekday)) map.set(s.weekday, []);
        map.get(s.weekday).push(s);
      } else {
        datedList.push(s);
      }
    });
    map.forEach((list) =>
      list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    );
    return { byDay: [...map.entries()].sort((a, b) => a[0] - b[0]), dated: datedList };
  }, [sessions]);

  const levelOptions = levels
    .filter((l) => !filters.program || String(l.program) === String(filters.program))
    .map((l) => ({ value: l.id, label: l.label }));

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={
          auth.isStudent && !auth.isStaff
            ? "Your program & level schedule for the current teaching weeks (Africa/Douala)."
            : "Published teaching sessions. Filter by program, level, semester or lecturer."
        }
        actions={
          <Button variant="secondary" icon="refresh" onClick={timetable.reload}>
            Refresh
          </Button>
        }
      />

      {canFilter ? (
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Program">
              <Select
                value={filters.program}
                onChange={(e) => setFilters((s) => ({ ...s, program: e.target.value, level: "" }))}
                placeholder="All programs"
                options={programs.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field label="Level">
              <Select
                value={filters.level}
                onChange={(e) => setFilters((s) => ({ ...s, level: e.target.value }))}
                placeholder="All levels"
                options={levelOptions}
              />
            </Field>
            <Field label="Semester">
              <Select
                value={filters.semester}
                onChange={(e) => setFilters((s) => ({ ...s, semester: e.target.value }))}
                placeholder="All semesters"
                options={semesters.map((s) => ({
                  value: s.id,
                  label: s.academic_year_label ? `${s.academic_year_label} · ${s.semester_type}` : String(s.id),
                }))}
              />
            </Field>
            <Field label="Lecturer">
              <Select
                value={filters.lecturer}
                onChange={(e) => setFilters((s) => ({ ...s, lecturer: e.target.value }))}
                placeholder="All lecturers"
                options={lecturers.map((l) => ({ value: l.id, label: l.full_name }))}
              />
            </Field>
          </div>
        </Card>
      ) : null}

      {timetable.loading ? (
        <LoadingState label="Loading timetable…" />
      ) : timetable.error ? (
        <ErrorState error={timetable.error} onRetry={timetable.reload} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No sessions scheduled"
          message="Timetable sessions appear once offerings are published with weekly sessions."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {byDay.map(([weekday, daySessions]) => (
              <Card key={weekday} pad={false} className="h-fit overflow-hidden">
                <div className="flex items-center justify-between bg-brand-950 px-4 py-3">
                  <h2 className="font-display font-semibold text-white">{DAYS[weekday] || `Day ${weekday}`}</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-gold-300">
                    {daySessions.length} session(s)
                  </span>
                </div>
                {daySessions.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No classes</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {daySessions.map((s) => (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-brand-900">{s.course_code}</span>
                          <span className="ml-auto text-xs font-semibold text-slate-500">
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-600">{s.course_title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {[s.room, s.campus].filter(Boolean).join(" · ") || "Room TBA"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>

          {dated.length ? (
            <Card pad={false} className="mt-4 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">One-off dated sessions</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {dated.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="font-mono text-sm font-bold text-brand-900">{s.course_code}</span>
                    <span className="flex-1 text-sm text-slate-600">{s.course_title}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {formatDate(s.session_date)} · {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      {s.room ? ` · ${s.room}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

