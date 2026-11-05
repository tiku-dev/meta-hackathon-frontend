import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  GradeBadge,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  TableCard,
  TextInput,
  useToast,
} from "../components/ui";
import { Icon } from "../components/icons";
import { useAuth } from "../lib/auth";
import { api, downloadFile } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useLookup } from "../lib/lookups";
import { formatMoney, formatNumber } from "../lib/format";

/**
 * HOD marks upload: the Head of Department first picks an academic year
 * and semester, then sees ALL of their department's courses for that
 * semester listed (lecturer, students, marks progress) and chooses which
 * course to publish marks for — either by filling a single roster form
 * (student name, matricule, CA, exam) or by uploading a CSV scoped to
 * that course. Marks are routed to each student by matricule and
 * published to them immediately; students whose fees have not cleared
 * are held back (nothing is saved) and, in the form, sit locked at the
 * bottom with no action possible.
 */
export function HodMarksUploadPage() {
  const auth = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const years = useLookup("years");
  const allSemesters = useLookup("semesters");
  const overview = useApi("/hod/department/overview");

  const [yearId, setYearId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(""); // "", "preview", "upload", "template"
  const [report, setReport] = useState(null);
  const [mode, setMode] = useState(""); // "preview" | "done"
  const [inputMode, setInputMode] = useState("form"); // "form" | "csv"

  // The course list for the chosen year/semester drives everything else:
  // the HOD sees all department courses and picks which one to publish.
  const coursesReq = useApi(
    yearId && semesterId
      ? `/hod/marks-form/offerings?academic_year=${yearId}&semester=${semesterId}`
      : null,
    { deps: [yearId, semesterId], enabled: Boolean(yearId && semesterId) },
  );
  const courseRows = useMemo(() => coursesReq.data?.offerings || [], [coursesReq.data]);
  const selectedCourse = useMemo(
    () => courseRows.find((o) => String(o.id) === String(offeringId)) || null,
    [courseRows, offeringId],
  );

  const semesters = useMemo(
    () => allSemesters.filter((s) => !yearId || String(s.academic_year) === String(yearId)),
    [allSemesters, yearId],
  );
  const canSubmit = Boolean(yearId && semesterId && offeringId && file);

  function chooseCourse(id) {
    setOfferingId(id);
    setReport(null);
    setMode("");
  }

  async function run(dryRun) {
    if (!yearId || !semesterId) {
      toast.error("Choose the academic year and semester first.");
      return;
    }
    if (!offeringId) {
      toast.error("Choose which course to publish marks for first.");
      return;
    }
    if (!file) {
      toast.error("Choose a CSV file to upload.");
      return;
    }
    setBusy(dryRun ? "preview" : "upload");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("academic_year", yearId);
      form.append("semester", semesterId);
      form.append("offering", offeringId);
      if (dryRun) form.append("dry_run", "1");
      const res = await api("/hod/marks-upload", { method: "POST", body: form });
      setReport(res);
      setMode(dryRun ? "preview" : "done");
      if (!dryRun) {
        toast.success(
          `${res.summary.uploaded} mark(s) published to students` +
            (res.summary.held_fees ? ` · ${res.summary.held_fees} held for unpaid fees` : ""),
        );
        coursesReq.reload();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function downloadTemplate() {
    setBusy("template");
    try {
      await downloadFile("/hod/marks-upload/template", "hod-marks-template.csv");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Marks upload"
        subtitle={`Enter CA and exam marks for ${auth.lecturer?.department_name || "your department"}: choose the year and semester, then pick a course from the list to publish its marks. Marks go straight to each student by matricule.`}
        actions={
          inputMode === "csv" ? (
            <Button variant="secondary" icon="download" loading={busy === "template"} onClick={downloadTemplate}>
              Download CSV template
            </Button>
          ) : null
        }
      />

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="1 · Academic year" required>
            <Select
              value={yearId}
              onChange={(e) => {
                setYearId(e.target.value);
                setSemesterId("");
                setOfferingId("");
              }}
              placeholder="Select academic year…"
              options={years.map((y) => ({ value: y.id, label: y.label }))}
            />
          </Field>
          <Field label="2 · Semester" required>
            <Select
              value={semesterId}
              onChange={(e) => {
                setSemesterId(e.target.value);
                setOfferingId("");
              }}
              placeholder={yearId ? "Select semester…" : "Select a year first"}
              disabled={!yearId}
              options={semesters.map((s) => ({
                value: s.id,
                label: `${s.academic_year_label} · ${s.semester_type}`,
              }))}
            />
          </Field>
        </div>
      </Card>

      {yearId && semesterId ? (
        <CourseListCard
          coursesReq={coursesReq}
          selectedId={offeringId}
          onSelect={chooseCourse}
          departmentName={auth.lecturer?.department_name}
        />
      ) : (
        <EmptyState
          icon="calendar"
          title="Choose academic year and semester"
          message="Pick the year and semester above — all your department's courses for that semester will be listed here so you can choose which one to publish marks for."
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Choose how to enter marks">
        {[
          { key: "form", label: "4 · Fill marks form", icon: "edit", hint: "One form for the chosen course" },
          { key: "csv", label: "4 · Upload CSV", icon: "upload", hint: "CSV for the chosen course" },
        ].map((option) => {
          const active = inputMode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setInputMode(option.key)}
              className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-semibold ring-1 transition ${
                active
                  ? "bg-brand-700 text-white ring-brand-700 shadow-sm"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon name={option.icon} size={17} />
              <span>
                {option.label}
                <span className={`block text-[11px] font-normal ${active ? "text-white/75" : "text-slate-400"}`}>
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {inputMode === "form" ? (
        <MarksFormPanel
          yearId={yearId}
          semesterId={semesterId}
          offeringId={offeringId}
          selectedCourse={selectedCourse}
          onPublished={coursesReq.reload}
          toast={toast}
        />
      ) : (
        <>
          <Alert tone="info" className="mb-4" title="How CSV upload works">
            First choose the course above (step 3), then upload a CSV with columns{" "}
            <code>matricule,course_code,ca_mark,exam_mark</code> — one row per student for that
            course. Rows naming a different course are rejected. Use <strong>Preview</strong> to
            validate the file without saving anything, then <strong>Upload &amp; publish marks</strong>.
            Students whose fees have not cleared for the chosen semester are <strong>not</strong>{" "}
            uploaded: their marks are held back and listed below so you can re-upload them after
            they pay.
          </Alert>

          <Card className="mb-4">
            <div className="grid gap-4">
              <Field
                label={
                  selectedCourse
                    ? `Marks CSV file for ${selectedCourse.course_code} — ${selectedCourse.course_title}`
                    : "Marks CSV file"
                }
                required
                hint={
                  selectedCourse
                    ? `Publishing to ${selectedCourse.course_code} · ${selectedCourse.registered_students} registered student(s). Choose a different course in step 3 to change.`
                    : "Choose a course in step 3 above first."
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setReport(null);
                      setMode("");
                    }}
                  />
                  <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
                    Choose CSV file
                  </Button>
                  <span className="min-w-0 truncate text-sm text-slate-600">
                    {file ? file.name : "No file chosen"}
                  </span>
                </div>
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon="eye"
                loading={busy === "preview"}
                disabled={!canSubmit || Boolean(busy)}
                onClick={() => run(true)}
              >
                Preview (validate only)
              </Button>
              <Button
                icon="send"
                loading={busy === "upload"}
                disabled={!canSubmit || Boolean(busy)}
                onClick={() => run(false)}
              >
                Upload &amp; publish marks
              </Button>
            </div>
            {overview.data ? (
              <p className="mt-3 text-xs text-slate-400">
                Department scope: {overview.data.students ?? 0} student(s) ·{" "}
                {overview.data.offerings ?? 0} offering(s). Courses outside your department are rejected.
              </p>
            ) : null}
          </Card>

          {report ? <UploadReport report={report} mode={mode} /> : null}
        </>
      )}
    </div>
  );
}


function MiniStat({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-900",
    good: "text-brand-700",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  );
}

/* ----------------- Step 3: choose the course to publish ----------------- */

const MARKS_STATUS_META = {
  published: { label: "Marks published", tone: "bg-brand-50 text-brand-700 ring-brand-200" },
  in_progress: { label: "In progress", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  not_started: { label: "No marks yet", tone: "bg-slate-100 text-slate-500 ring-slate-300" },
};

function CourseListCard({ coursesReq, selectedId, onSelect, departmentName }) {
  const rows = coursesReq.data?.offerings || [];
  const summary = coursesReq.data?.summary || {};

  return (
    <TableCard
      title={`3 · Choose a course — ${departmentName || "your department"}`}
      subtitle={
        coursesReq.data
          ? `${coursesReq.data.semester_label} · ${summary.courses ?? rows.length} course(s): ${summary.published ?? 0} published, ${summary.in_progress ?? 0} in progress, ${summary.not_started ?? 0} not started. Click a course to publish its marks.`
          : "All courses of your department running in this semester."
      }
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          loading={coursesReq.loading}
          onClick={coursesReq.reload}
        >
          Refresh
        </Button>
      }
    >
      {coursesReq.loading && !rows.length ? (
        <LoadingState label="Loading department courses…" />
      ) : coursesReq.error ? (
        <div className="p-5">
          <ErrorState error={coursesReq.error} onRetry={coursesReq.reload} />
        </div>
      ) : (
        <DataTable
          rowKey={(o) => o.id}
          rows={rows}
          onRowClick={(o) => onSelect(String(o.id))}
          empty={
            <EmptyState
              icon="book"
              title="No courses this semester"
              message="Your department has no course offerings running in the selected semester. Create or publish offerings first, then come back to upload marks."
            />
          }
          columns={[
            {
              key: "course_code",
              header: "Course",
              render: (o) => {
                const selected = String(selectedId) === String(o.id);
                return (
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ${
                        selected
                          ? "bg-brand-700 text-white ring-brand-700"
                          : "bg-white text-transparent ring-slate-300"
                      }`}
                    >
                      <Icon name="check" size={12} />
                    </span>
                    <span>
                      <span className="font-mono font-bold text-brand-900">{o.course_code}</span>{" "}
                      <span className="text-slate-600">{o.course_title}</span>
                      {selected ? (
                        <span className="block text-xs font-semibold text-brand-700">
                          Selected — publishing marks for this course
                        </span>
                      ) : null}
                    </span>
                  </span>
                );
              },
            },
            { key: "credits", header: "Credits" },
            { key: "lecturer_name", header: "Lecturer", render: (o) => o.lecturer_name || "—" },
            {
              key: "registered_students",
              header: "Students",
              render: (o) => `${o.registered_students} / ${o.capacity}`,
            },
            {
              key: "progress",
              header: "Marks progress",
              render: (o) =>
                o.registered_students
                  ? `${o.published_count} of ${o.registered_students} published` +
                    (o.pending_count ? ` · ${o.pending_count} pending` : "")
                  : "No students yet",
            },
            {
              key: "marks_status",
              header: "Status",
              render: (o) => {
                const meta = MARKS_STATUS_META[o.marks_status] || MARKS_STATUS_META.not_started;
                return (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                );
              },
            },
            {
              key: "__open",
              header: "",
              className: "w-px whitespace-nowrap text-right",
              render: (o) => (
                <Button
                  size="sm"
                  variant={String(selectedId) === String(o.id) ? "primary" : "secondary"}
                  icon={String(selectedId) === String(o.id) ? "check" : "edit"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(String(o.id));
                  }}
                >
                  {String(selectedId) === String(o.id) ? "Selected" : "Publish marks"}
                </Button>
              ),
            },
          ]}
        />
      )}
    </TableCard>
  );
}

/* --------------------- Single-form mode (one course) --------------------- */

function MarksFormPanel({ yearId, semesterId, offeringId, selectedCourse, onPublished, toast }) {
  const [roster, setRoster] = useState(null);
  const [rosterState, setRosterState] = useState("idle");
  const [rosterError, setRosterError] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [formReport, setFormReport] = useState(null);

  const rosterKey =
    yearId && semesterId && offeringId ? `${yearId}:${semesterId}:${offeringId}` : "";

  // Load the roster of the course chosen in step 3 (and reload it when
  // the HOD picks a different course).
  useEffect(() => {
    if (!rosterKey) return undefined;
    let alive = true;
    (async () => {
      setRosterState("loading");
      setRosterError(null);
      try {
        const res = await api(
          `/hod/marks-form/roster?academic_year=${yearId}&semester=${semesterId}&offering=${offeringId}`,
        );
        if (!alive) return;
        setRoster(res);
        const initial = {};
        (res.students || []).forEach((s) => {
          if (s.can_enter_marks) {
            initial[s.registration_id] = { ca: s.ca_mark ?? "", exam: s.exam_mark ?? "" };
          }
        });
        setValues(initial);
        setFormReport(null);
        setRosterState("ready");
      } catch (err) {
        if (!alive) return;
        setRoster(null);
        setRosterError(err);
        setRosterState("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const students = useMemo(() => roster?.students || [], [roster]);
  const editableRows = useMemo(
    () => students.filter((s) => s.can_enter_marks),
    [students],
  );
  const unpaidRows = useMemo(
    () => students.filter((s) => !s.fees_cleared),
    [students],
  );
  const filledCount = useMemo(
    () =>
      editableRows.filter((s) => {
        const v = values[s.registration_id] || {};
        return String(v.ca ?? "").trim() !== "" || String(v.exam ?? "").trim() !== "";
      }).length,
    [editableRows, values],
  );

  async function reloadRoster() {
    if (!offeringId) return;
    setRosterState("loading");
    setRosterError(null);
    try {
      const res = await api(
        `/hod/marks-form/roster?academic_year=${yearId}&semester=${semesterId}&offering=${offeringId}`,
      );
      setRoster(res);
      const initial = {};
      (res.students || []).forEach((s) => {
        if (s.can_enter_marks) {
          initial[s.registration_id] = { ca: s.ca_mark ?? "", exam: s.exam_mark ?? "" };
        }
      });
      setValues(initial);
      setRosterState("ready");
    } catch (err) {
      setRoster(null);
      setRosterError(err);
      setRosterState("error");
    }
  }

  function setMark(registrationId, field, value) {
    setValues((prev) => ({
      ...prev,
      [registrationId]: { ...(prev[registrationId] || {}), [field]: value },
    }));
  }

  async function saveForm() {
    const marks = editableRows
      .map((s) => {
        const v = values[s.registration_id] || {};
        return {
          registration_id: s.registration_id,
          ca_mark: String(v.ca ?? "").trim() === "" ? null : Number(v.ca),
          exam_mark: String(v.exam ?? "").trim() === "" ? null : Number(v.exam),
        };
      })
      .filter((m) => m.ca_mark !== null || m.exam_mark !== null);
    if (!marks.length) {
      toast.error("Enter at least one student's CA and exam marks first.");
      return;
    }
    setSaving(true);
    try {
      const res = await api("/hod/marks-form/save", {
        method: "POST",
        body: {
          academic_year: Number(yearId),
          semester: Number(semesterId),
          offering: Number(offeringId),
          marks,
        },
      });
      if (res.summary.saved) {
        toast.success(`${res.summary.saved} mark(s) published to students.`);
      }
      if (res.summary.blocked_fees) {
        toast.error(`${res.summary.blocked_fees} student(s) refused — fees not cleared.`);
      }
      await reloadRoster();
      onPublished?.();
      setFormReport(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!yearId || !semesterId) {
    return (
      <EmptyState
        icon="calendar"
        title="Choose academic year and semester"
        message="Pick the academic year and semester above, then choose a course to load its marks form."
      />
    );
  }

  if (!offeringId) {
    return (
      <EmptyState
        icon="book"
        title="Choose a course to publish marks for"
        message="All your department's courses for this semester are listed in step 3 above. Click “Publish marks” on a course and its marks form opens here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              4 · Marks form — {selectedCourse?.course_code || roster?.offering.course_code || "…"}
            </h2>
            <p className="text-xs text-slate-500">
              {selectedCourse
                ? `${selectedCourse.course_title} · ${selectedCourse.registered_students} registered student(s)`
                : ""}
              {roster
                ? ` · CA max ${roster.policy.ca_max ?? "—"} · Exam max ${roster.policy.exam_max ?? "—"}${
                    roster.policy.name ? ` · ${roster.policy.name}` : ""
                  }`
                : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            icon="refresh"
            disabled={rosterState === "loading" || saving}
            onClick={reloadRoster}
          >
            Reload form
          </Button>
        </div>
      </Card>

      {rosterState === "loading" ? (
        <LoadingState />
      ) : rosterState === "error" ? (
        <ErrorState error={rosterError} onRetry={reloadRoster} />
      ) : roster ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Students on roster" value={formatNumber(roster.summary.total_students)} />
            <MiniStat label="Can enter marks" value={formatNumber(roster.summary.can_enter_marks)} tone="good" />
            <MiniStat label="Already published" value={formatNumber(roster.summary.already_published)} />
            <MiniStat label="Fees not cleared (locked)" value={formatNumber(roster.summary.fees_not_cleared)} tone="warn" />
          </div>

          <Alert tone="info" title="One form for the whole class">
            Type each student's CA and exam marks, then save once — marks are published straight to
            the students. Students who have not cleared their fees are listed at the{" "}
            <strong>bottom</strong> of this form with their fields locked: no action can be taken on
            them until they pay.
          </Alert>

          <TableCard
            title={`Marks form — ${roster.offering.course_code}`}
            subtitle={`${editableRows.length} student(s) ready for marks · ${unpaidRows.length} locked at the bottom (fees not cleared)`}
            actions={
              <Button icon="send" loading={saving} disabled={saving || !filledCount} onClick={saveForm}>
                Save &amp; publish marks ({filledCount})
              </Button>
            }
          >
            {students.length === 0 ? (
              <EmptyState
                icon="users"
                title="No students registered"
                message="No student is registered for this course in the selected semester yet."
              />
            ) : (
              <div className="nice-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student name</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Matricule</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">CA (max {roster.policy.ca_max ?? "—"})</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Exam (max {roster.policy.exam_max ?? "—"})</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total / grade</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s, index) => (
                      <FormStudentRow
                        key={`${rosterKey}-${s.registration_id}`}
                        index={index}
                        student={s}
                        value={values[s.registration_id] || {}}
                        onChange={setMark}
                        saving={saving}
                        caMax={roster.policy.ca_max}
                        examMax={roster.policy.exam_max}
                        showUnpaidHeader={index > 0 && !s.fees_cleared && students[index - 1].fees_cleared}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-xs text-slate-500">
                {filledCount} of {editableRows.length} editable student(s) filled. Saving publishes
                immediately; blank rows are skipped.
              </p>
              <Button icon="send" loading={saving} disabled={saving || !filledCount} onClick={saveForm}>
                Save &amp; publish marks
              </Button>
            </div>
          </TableCard>

          {formReport ? <FormSaveReport report={formReport} /> : null}
        </>
      ) : (
        <EmptyState
          icon="book"
          title="Choose a course"
          message="Choose a course in step 3 above to load the single marks form with every registered student."
        />
      )}
    </div>
  );
}

function FormStudentRow({ index, student: s, value, onChange, saving, caMax, examMax, showUnpaidHeader }) {
  const published = s.result_status === "published" || s.result_status === "locked";
  const locked = !s.can_enter_marks;
  const header = showUnpaidHeader ? (
    <tr className="bg-amber-50">
      <td colSpan={7} className="px-4 py-2.5 text-xs font-semibold text-amber-800">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" size={13} /> Fees not cleared — no action can be taken on the students
          below until they pay. Their mark fields are locked.
        </span>
      </td>
    </tr>
  ) : null;

  return (
    <>
      {header}
      <tr className={locked ? "bg-slate-50/80 text-slate-400" : undefined}>
        <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
        <td className="px-4 py-2.5">
          <span className={`font-medium ${locked ? "text-slate-500" : "text-slate-800"}`}>
            {s.student_name}
          </span>
          {!s.fees_cleared ? (
            <span className="block text-xs text-amber-600">
              Fees not cleared
              {s.fee?.balance != null
                ? ` · balance ${formatMoney(s.fee.balance, s.fee.currency || "USD")}`
                : ""}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{s.matricule || "—"}</td>
        <td className="px-4 py-2.5">
          <TextInput
            type="number"
            min="0"
            max={caMax ?? undefined}
            step="0.01"
            className="w-24"
            value={value.ca ?? (published ? s.ca_mark ?? "" : "")}
            disabled={locked || saving}
            placeholder={locked ? "Locked" : "CA"}
            aria-label={`CA mark for ${s.student_name}`}
            onChange={(e) => onChange(s.registration_id, "ca", e.target.value)}
          />
        </td>
        <td className="px-4 py-2.5">
          <TextInput
            type="number"
            min="0"
            max={examMax ?? undefined}
            step="0.01"
            className="w-24"
            value={value.exam ?? (published ? s.exam_mark ?? "" : "")}
            disabled={locked || saving}
            placeholder={locked ? "Locked" : "Exam"}
            aria-label={`Exam mark for ${s.student_name}`}
            onChange={(e) => onChange(s.registration_id, "exam", e.target.value)}
          />
        </td>
        <td className="px-4 py-2.5">
          {published ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold text-slate-700">{s.total ?? "—"}</span>
              <GradeBadge letter={s.grade_letter} />
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {!s.fees_cleared ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <Icon name="lock" size={11} /> No action — fees unpaid
            </span>
          ) : published ? (
            <StatusBadge status={s.result_status} />
          ) : s.can_enter_marks ? (
            <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
              Ready for marks
            </span>
          ) : (
            <StatusBadge status={s.registration_status} />
          )}
        </td>
      </tr>
    </>
  );
}

function FormSaveReport({ report }) {
  const s = report.summary || {};
  return (
    <div className="space-y-4">
      <Alert tone="success" title="Form saved">
        {s.saved ?? 0} mark(s) published for {report.course_code}
        {s.blocked_fees ? ` · ${s.blocked_fees} refused (fees not cleared)` : ""}
        {s.locked ? ` · ${s.locked} already published` : ""}
        {s.errors ? ` · ${s.errors} rejected` : ""}. The form above has been refreshed.
      </Alert>

      <ReportSection
        title="Published to students"
        rows={report.saved || []}
        rowKey={(r) => `form-saved-${r.registration_id}`}
        emptyTitle="Nothing published"
        emptyMessage="No new mark was published by this save."
        columns={[
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
          { key: "student_name", header: "Student" },
          { key: "ca_mark", header: "CA" },
          { key: "exam_mark", header: "Exam" },
          { key: "total", header: "Total" },
          { key: "grade_letter", header: "Grade", render: (r) => <GradeBadge letter={r.grade_letter} /> },
        ]}
      />

      <ReportSection
        title="Refused — fees not cleared"
        subtitle="The server refused these marks: no action can be taken until the student pays."
        rows={report.blocked_fees || []}
        rowKey={(r) => `form-blocked-${r.registration_id}`}
        emptyTitle="No refused marks"
        emptyMessage="Every submitted student had cleared their fees."
        columns={[
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
          { key: "student_name", header: "Student" },
          {
            key: "balance",
            header: "Fee balance",
            render: (r) => (r.balance != null ? formatMoney(r.balance, r.currency || "USD") : "No invoice"),
          },
          { key: "error", header: "Reason", render: (r) => <span className="text-amber-700">{r.error}</span> },
        ]}
      />

      <ReportSection
        title="Problems"
        rows={[...(report.locked || []), ...(report.errors || [])]}
        rowKey={(r, i) => `form-err-${r.registration_id}-${i}`}
        emptyTitle="No problems"
        emptyMessage="Every filled row was accepted."
        columns={[
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule || "—"}</span> },
          { key: "student_name", header: "Student" },
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.code}</span> },
          { key: "error", header: "Problem", render: (r) => <span className="text-red-700">{r.error}</span> },
        ]}
      />
    </div>
  );
}

function ReportSection({ title, subtitle, rows, columns, emptyTitle, emptyMessage, rowKey }) {
  if (!rows?.length) {
    return <EmptyState icon="check" title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <Card pad={false} className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={rowKey} />
    </Card>
  );
}

function UploadReport({ report, mode }) {
  const s = report.summary || {};
  const preview = mode === "preview";

  return (
    <div className="space-y-4">
      <Alert tone={preview ? "info" : "success"} title={preview ? "Preview — nothing was saved" : "Upload complete"}>
        {preview
          ? "This is what would happen if you upload now. Review the rows below, then use “Upload & publish marks” to save and publish them."
          : "Uploaded marks are now published — each student can see them under My results."}{" "}
        Semester: <strong>{report.semester_label}</strong> ({report.academic_year_label}).
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Rows in file" value={s.total_rows ?? 0} />
        <MiniStat label={preview ? "Ready to publish" : "Published"} value={s.uploaded ?? 0} tone="good" />
        <MiniStat label="Held — fees unpaid" value={s.held_fees ?? 0} tone="warn" />
        <MiniStat label="Already published" value={s.locked ?? 0} tone="warn" />
        <MiniStat label="Rejected rows" value={s.errors ?? 0} tone="bad" />
      </div>

      <ReportSection
        title={preview ? "Ready to publish" : "Published to students"}
        subtitle="Marks routed to each student by matricule."
        rows={report.uploaded || []}
        rowKey={(r, i) => `up-${r.row}-${i}`}
        emptyTitle="No marks ready"
        emptyMessage="No row in this file can be published yet."
        columns={[
          { key: "row", header: "Row" },
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
          { key: "student_name", header: "Student" },
          { key: "course_code", header: "Course", render: (r) => <span className="font-mono text-xs font-semibold">{r.course_code}</span> },
          { key: "ca_mark", header: "CA" },
          { key: "exam_mark", header: "Exam" },
          { key: "total", header: "Total" },
          { key: "grade_letter", header: "Grade", render: (r) => <GradeBadge letter={r.grade_letter} /> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />


      <ReportSection
        title="Held back — fees not paid"
        subtitle="These marks were NOT uploaded. Re-upload the same rows after the student clears their fees for this semester."
        rows={report.held_fees || []}
        rowKey={(r, i) => `held-${r.row}-${i}`}
        emptyTitle="No held marks"
        emptyMessage="Every matched student has cleared their fees for this semester."
        columns={[
          { key: "row", header: "Row" },
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
          { key: "student_name", header: "Student" },
          { key: "course_code", header: "Course", render: (r) => <span className="font-mono text-xs font-semibold">{r.course_code}</span> },
          { key: "ca_mark", header: "CA" },
          { key: "exam_mark", header: "Exam" },
          {
            key: "balance",
            header: "Fee balance",
            render: (r) =>
              r.balance != null ? formatMoney(r.balance, r.currency || "USD") : "No invoice",
          },
          { key: "error", header: "Why held", render: (r) => <span className="text-amber-700">{r.error}</span> },
        ]}
      />

      <ReportSection
        title="Already published (skipped)"
        subtitle="Re-uploading never overwrites a published result — use an audited correction instead."
        rows={report.locked || []}
        rowKey={(r, i) => `lock-${r.row}-${i}`}
        emptyTitle="Nothing skipped"
        emptyMessage="No row clashed with an already-published result."
        columns={[
          { key: "row", header: "Row" },
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
          { key: "student_name", header: "Student" },
          { key: "course_code", header: "Course", render: (r) => <span className="font-mono text-xs font-semibold">{r.course_code}</span> },
          { key: "error", header: "Reason" },
        ]}
      />

      <ReportSection
        title="Rejected rows"
        subtitle="Fix these rows in the CSV and upload them again — valid rows are never blocked by bad ones."
        rows={report.errors || []}
        rowKey={(r, i) => `err-${r.row}-${i}`}
        emptyTitle="No rejected rows"
        emptyMessage="Every row passed validation."
        columns={[
          { key: "row", header: "Row" },
          { key: "matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.matricule || "—"}</span> },
          { key: "course_code", header: "Course", render: (r) => <span className="font-mono text-xs font-semibold">{r.course_code || "—"}</span> },
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.code}</span> },
          { key: "error", header: "Problem", render: (r) => <span className="text-red-700">{r.error}</span> },
        ]}
      />
    </div>
  );
}

