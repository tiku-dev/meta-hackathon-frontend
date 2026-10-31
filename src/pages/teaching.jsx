import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  GradeBadge,
  StatusBadge,
  TableCard,
  TextInput,
  useToast,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { api, qs } from "../lib/api";
import { useApi, usePagedList } from "../lib/hooks";
import { formatDate, num } from "../lib/format";

/* --------------------------- My classes list --------------------------- */

export function MyClassesPage() {
  const auth = useAuth();
  const profile = auth.lecturer;
  const [search, setSearch] = useState("");
  const query = qs({ lecturer: profile?.id, search: search || undefined });
  const list = usePagedList(`/admin/course-offerings/${query}`, { deps: [query], pageSize: 25 });

  return (
    <div>
      <PageHeader
        title="My classes & marks"
        subtitle="Course offerings assigned to you. Open a class to enter CA / exam marks or record attendance."
      />
      {!profile ? (
        <Alert tone="warning">
          Your account is not linked to a lecturer profile yet, so no classes can be shown. Ask an
          administrator to assign your account on the Lecturers page.
        </Alert>
      ) : (
        <TableCard
          title={`Classes for ${profile.full_name}`}
          subtitle={profile.department_name || ""}
          actions={
            <TextInput
              placeholder="Search course code or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          }
        >
          {list.loading && !list.rows.length ? (
            <LoadingState />
          ) : list.error ? (
            <div className="p-5">
              <ErrorState error={list.error} onRetry={list.reload} />
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "course",
                  header: "Course",
                  render: (o) => (
                    <Link to={`/teaching/classes/${o.id}`} className="group">
                      <span className="font-mono font-bold text-brand-900 group-hover:underline">{o.course_code}</span>{" "}
                      <span className="text-slate-600">{o.course_title}</span>
                    </Link>
                  ),
                },
                { key: "semester_label", header: "Semester" },
                { key: "credits", header: "Credits" },
                { key: "enrolled", header: "Enrolled", render: (o) => `${o.enrolled_count} / ${o.capacity}` },
                { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
                {
                  key: "__open",
                  header: "",
                  className: "text-right",
                  render: (o) => (
                    <Link to={`/teaching/classes/${o.id}`}>
                      <Button size="sm">Open class</Button>
                    </Link>
                  ),
                },
              ]}
              rows={list.rows}
              empty={
                <EmptyState
                  icon="book"
                  title="No classes assigned"
                  message="When an offering is assigned to you, it will appear here."
                />
              }
            />
          )}
        </TableCard>
      )}
    </div>
  );
}

/* ---------------------------- Class detail ----------------------------- */

export function ClassDetailPage() {
  const { offeringId } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState("marks");

  const offeringReq = useApi(`/admin/course-offerings/${offeringId}/`);
  const marks = useApi(`/lecturer/offerings/${offeringId}/results`);
  const roster = useApi(`/admin/course-offerings/${offeringId}/roster/`);
  const sessions = useApi(`/admin/timetable-sessions/?offering=${offeringId}&page_size=100`);

  const offering = offeringReq.data;
  const policy = marks.data?.policy;

  if (offeringReq.loading || marks.loading) return <LoadingState label="Loading class…" />;
  if (offeringReq.error) return <ErrorState error={offeringReq.error} onRetry={offeringReq.reload} />;
  if (marks.error) return <ErrorState error={marks.error} onRetry={marks.reload} />;

  return (
    <div>
      <PageHeader
        title={`${offering?.course_code || ""} — ${offering?.course_title || "Class"}`}
        subtitle={`${offering?.semester_label || ""} · ${offering?.enrolled_count ?? 0}/${offering?.capacity ?? "—"} enrolled · ${offering?.credits ?? "—"} credits${offering?.lecturer_name ? ` · ${offering.lecturer_name}` : ""}`}
        actions={
          <>
            <StatusBadge status={offering?.status} />
            <Link to="/teaching/classes">
              <Button variant="secondary">All classes</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-200/60 p-1 sm:w-fit">
        {[
          ["marks", "Marks entry"],
          ["attendance", "Attendance"],
          ["roster", "Roster"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key ? "bg-white text-brand-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "marks" ? (
        <MarksTab offeringId={offeringId} data={marks.data} policy={policy} reload={marks.reload} toast={toast} />
      ) : null}
      {tab === "attendance" ? (
        <AttendanceTab
          offeringId={offeringId}
          roster={roster.data || []}
          sessions={sessions.data?.results || []}
          toast={toast}
        />
      ) : null}
      {tab === "roster" ? (
        roster.loading ? (
          <LoadingState />
        ) : roster.error ? (
          <ErrorState error={roster.error} onRetry={roster.reload} />
        ) : (
          <Card pad={false} className="overflow-hidden">
            <DataTable
              columns={[
                { key: "student_matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.student_matricule}</span> },
                { key: "student_name", header: "Student" },
                { key: "course_code", header: "Course" },
                { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={roster.data || []}
              empty={<EmptyState icon="users" title="No students enrolled yet" />}
            />
          </Card>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------ Marks tab ------------------------------ */

function MarksTab({ offeringId, data, policy, reload, toast }) {
  const auth = useAuth();
  const isHod = auth.has("hod");
  const rosterReq = useApi(`/admin/course-offerings/${offeringId}/roster/`);
  const savedResults = useMemo(() => data?.results || [], [data]);
  const resultByRegistration = useMemo(() => {
    const map = new Map();
    savedResults.forEach((r) => map.set(r.registration, r));
    return map;
  }, [savedResults]);

  const rows = useMemo(() => {
    const rosterRows = (rosterReq.data || [])
      .filter((r) => r.status === "registered" || r.status === "completed")
      .map((r) => {
        const saved = resultByRegistration.get(r.id);
        return {
          registration_id: r.id,
          student_matricule: r.student_matricule,
          student_name: r.student_name,
          registration_status: r.status,
          ca_mark: saved?.ca_mark ?? "",
          final_mark: saved?.final_mark ?? "",
          total: saved?.total ?? null,
          grade_letter: saved?.grade_letter ?? null,
          grade_points: saved?.grade_points ?? null,
          status: saved?.status ?? "not_started",
          has_saved: Boolean(saved),
        };
      });
    const inRoster = new Set(rosterRows.map((r) => r.registration_id));
    savedResults.forEach((r) => {
      if (!inRoster.has(r.registration)) {
        rosterRows.push({
          registration_id: r.registration,
          student_matricule: r.student_matricule,
          student_name: r.student_name,
          registration_status: "result_only",
          ca_mark: r.ca_mark ?? "",
          final_mark: r.final_mark ?? "",
          total: r.total ?? null,
          grade_letter: r.grade_letter ?? null,
          grade_points: r.grade_points ?? null,
          status: r.status ?? "draft",
          has_saved: true,
        });
      }
    });
    return rosterRows.sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || "")),
    );
  }, [rosterReq.data, resultByRegistration, savedResults]);

  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dirty, setDirty] = useState({});
  const [locked, setLocked] = useState(false);
  const serverSignature = useMemo(
    () => rows.map((r) => `${r.registration_id}:${r.ca_mark}:${r.final_mark}:${r.status || ""}`).join("|"),
    [rows],
  );
  const [lastSignature, setLastSignature] = useState("");
  const serverBusy = rows.some((r) => ["published", "locked", "hod_approved"].includes(r.status));
  const formLocked = locked || serverBusy;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocked(rows.some((r) => ["published", "locked"].includes(r.status)));
  }, [rows]);

  if (serverSignature !== lastSignature && !Object.keys(dirty).length) {
    const next = {};
    rows.forEach((r) => {
      next[r.registration_id] = {
        ca_mark: r.ca_mark === null || r.ca_mark === undefined ? "" : String(r.ca_mark),
        final_mark: r.final_mark === null || r.final_mark === undefined ? "" : String(r.final_mark),
      };
    });
    setDraft(next);
    setLastSignature(serverSignature);
  }

  const caMax = policy?.ca_max != null ? num(policy.ca_max) : 30;
  const examMax = policy?.exam_max != null ? num(policy.exam_max) : 70;
  const changedCount = Object.keys(dirty).length;
  const savedCount = rows.filter((r) => r.has_saved).length;

  const updateMark = (registrationId, field, value) => {
    setDraft((s) => ({ ...s, [registrationId]: { ...(s[registrationId] || {}), [field]: value } }));
    setDirty((s) => ({ ...s, [registrationId]: true }));
  };
  const parseMark = (v) => (v === "" || v == null ? null : Number(v));

  async function save(submit) {
    const marks = Object.entries(draft)
      .filter(([id]) => dirty[id] || !resultByRegistration.has(Number(id)))
      .map(([id, values]) => {
        const saved = resultByRegistration.get(Number(id));
        return {
          registration_id: Number(id),
          ca_mark: parseMark(values.ca_mark !== undefined ? values.ca_mark : saved?.ca_mark),
          final_mark: parseMark(values.final_mark !== undefined ? values.final_mark : saved?.final_mark),
        };
      })
      .filter((m) => m.ca_mark != null || m.final_mark != null);
    if (!marks.length) {
      toast.info("No mark changes to save yet.");
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const res = await api(`/lecturer/offerings/${offeringId}/results`, {
        method: "PUT",
        body: { submit, marks },
      });
      const failed = res?.errors || [];
      setErrors(failed);
      if (failed.length) toast.error(`${failed.length} row(s) could not be saved.`);
      else {
        toast.success(
          submit
            ? isHod
              ? "Marks submitted — approve & publish them from Results review."
              : "Marks submitted for HOD review."
            : "Draft marks saved.",
        );
        setDirty({});
      }
      reload();
      rosterReq.reload();
    } catch (err) {
      if (err.code === "RESULTS_LOCKED") setLocked(true);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (rosterReq.loading && !rows.length) return <LoadingState label="Loading roster & marks…" />;
  if (rosterReq.error) return <ErrorState error={rosterReq.error} onRetry={rosterReq.reload} />;

  return (
    <Card pad={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Marks entry</h2>
          <p className="text-xs text-slate-500">
            {policy
              ? `${policy.name} · CA /${policy.ca_max} · Exam /${policy.exam_max} · Pass mark ${policy.pass_mark}`
              : "No active grading policy returned — the server still validates every mark."}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {rows.length} roster student(s) · {savedCount} saved · {changedCount} unsaved change(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={saving} disabled={saving || formLocked} onClick={() => save(false)}>
            Save drafts
          </Button>
          <Button loading={saving} disabled={saving || formLocked} onClick={() => save(true)} icon="send">
            {isHod ? "Submit marks" : "Submit for HOD review"}
          </Button>
        </div>
      </div>

      {formLocked ? (
        <div className="px-5 py-4">
          <Alert tone="warning">This result set is approved, published or locked, so the grid is read-only.</Alert>
        </div>
      ) : null}
      {errors.length ? (
        <div className="px-5 py-4">
          <Alert tone="error" title="Some rows were rejected">
            <ul className="list-inside list-disc">
              {errors.map((e, i) => (
                <li key={i}>Registration #{e.registration_id}: {JSON.stringify(e.errors || e.error || e)}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon="users" title="No enrolled students" message="Marks can be entered once at least one student is registered for this offering." />
      ) : (
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {["Matricule", "Student", `CA /${caMax}`, `Exam /${examMax}`, "Total", "Grade", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const values = draft[r.registration_id] || { ca_mark: "", final_mark: "" };
                const rowLocked = formLocked || ["published", "locked", "hod_approved"].includes(r.status);
                return (
                  <tr key={r.registration_id} className={dirty[r.registration_id] ? "bg-gold-100/40" : ""}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.student_matricule}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-800">{r.student_name}</span>
                      <span className="block text-[11px] text-slate-400">{r.registration_status}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <TextInput type="number" min="0" max={caMax} step="0.01" className="w-24" value={values.ca_mark} disabled={rowLocked}
                        onChange={(e) => updateMark(r.registration_id, "ca_mark", e.target.value)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <TextInput type="number" min="0" max={examMax} step="0.01" className="w-24" value={values.final_mark} disabled={rowLocked}
                        onChange={(e) => updateMark(r.registration_id, "final_mark", e.target.value)} />
                    </td>
                    <td className="px-4 py-2.5 font-bold">{r.total ?? "—"}</td>
                    <td className="px-4 py-2.5"><GradeBadge letter={r.grade_letter} points={r.grade_points} /></td>
                    <td className="px-4 py-2.5">
                      {r.status === "not_started"
                        ? <span className="text-xs font-semibold text-slate-400">Not started</span>
                        : <StatusBadge status={r.status} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Totals and grades are recalculated by the server from the active policy. Students only see results after publication.
      </p>
    </Card>
  );
}

/* ---------------------------- Attendance tab ---------------------------- */

function AttendanceTab({ offeringId, roster, sessions, toast }) {
  const [sessionId, setSessionId] = useState("");
  const [statusByStudent, setStatusByStudent] = useState({});
  const [lastSessionId, setLastSessionId] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [savedRows, setSavedRows] = useState([]);

  const selectedSession = sessions.find((s) => String(s.id) === String(sessionId));
  const activeRoster = roster.filter((r) => r.status === "registered" || r.status === "completed");

  if (sessionId !== lastSessionId) {
    setLastSessionId(sessionId);
    const initial = {};
    activeRoster.forEach((r) => {
      initial[r.student] = "present";
    });
    setStatusByStudent(initial);
  }

  const setAll = (status) => {
    const next = {};
    activeRoster.forEach((r) => {
      next[r.student] = status;
    });
    setStatusByStudent(next);
  };

  async function save() {
    if (!sessionId) {
      toast.error("Choose a timetable session first.");
      return;
    }
    setSaving(true);
    try {
      const res = await api(`/lecturer/offerings/${offeringId}/attendance`, {
        method: "POST",
        body: {
          session_id: Number(sessionId),
          records: activeRoster.map((r) => ({
            student_id: r.student,
            status: statusByStudent[r.student] || "present",
            note: "",
          })),
        },
      });
      setSavedRows(Array.isArray(res) ? res : []);
      toast.success(`Attendance saved for ${activeRoster.length} student(s).`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!sessions.length) {
    return (
      <EmptyState
        icon="calendar"
        title="No timetable sessions for this offering"
        message="Create timetable sessions for the offering first, then attendance can be recorded against a session."
      />
    );
  }

  return (
    <Card pad={false} className="overflow-hidden">
      <div className="grid gap-4 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <Field label="Timetable session">
          <Select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Select a session…"
            options={sessions.map((s) => ({
              value: s.id,
              label: `${s.weekday_label || formatDate(s.session_date)} · ${s.start_time}–${s.end_time}${s.room ? ` · ${s.room}` : ""}`,
            }))}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAll("present")}>All present</Button>
          <Button variant="secondary" size="sm" onClick={() => setAll("absent")}>All absent</Button>
          <Button size="sm" loading={saving} disabled={!selectedSession || saving} onClick={save} icon="check">
            Save attendance
          </Button>
        </div>
      </div>

      {selectedSession ? (
        <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-500">
          {selectedSession.course_code} · {selectedSession.weekday_label || formatDate(selectedSession.session_date)} · {selectedSession.start_time}–{selectedSession.end_time}
          {selectedSession.room ? ` · Room ${selectedSession.room}` : ""}. Saving again updates the same session/student records.
        </p>
      ) : null}

      {activeRoster.length === 0 ? (
        <EmptyState icon="users" title="No active roster" message="Attendance needs registered or completed students on the roster." />
      ) : (
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Matricule</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeRoster.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.student_matricule}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.student_name}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {["present", "absent", "late", "excused"].map((st) => {
                        const active = (statusByStudent[r.student] || "present") === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatusByStudent((s) => ({ ...s, [r.student]: st }))}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                              active
                                ? st === "present"
                                  ? "bg-brand-700 text-white ring-brand-700"
                                  : st === "absent"
                                    ? "bg-red-600 text-white ring-red-600"
                                    : "bg-gold-500 text-brand-950 ring-gold-500"
                                : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {savedRows.length ? (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-brand-700">
          Last save returned {savedRows.length} attendance record(s).
        </p>
      ) : null}
    </Card>
  );
}





