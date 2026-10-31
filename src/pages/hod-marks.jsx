import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  GradeBadge,
  PageHeader,
  Select,
  StatusBadge,
  useToast,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { api, downloadFile } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useLookup } from "../lib/lookups";
import { formatMoney } from "../lib/format";

/**
 * HOD marks upload: the Head of Department uploads CA + exam marks for
 * their whole department in one CSV (matricule, course_code, ca_mark,
 * exam_mark) for a chosen academic year + semester. Marks are routed to
 * each student by matricule and published to them immediately; students
 * whose fees have not cleared are held back (nothing is saved) and
 * listed so the HOD can re-upload once they pay.
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
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(""); // "", "preview", "upload", "template"
  const [report, setReport] = useState(null);
  const [mode, setMode] = useState(""); // "preview" | "done"

  const semesters = useMemo(
    () => allSemesters.filter((s) => !yearId || String(s.academic_year) === String(yearId)),
    [allSemesters, yearId],
  );
  const canSubmit = Boolean(yearId && semesterId && file);

  async function run(dryRun) {
    if (!yearId || !semesterId) {
      toast.error("Choose the academic year and semester first.");
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
      if (dryRun) form.append("dry_run", "1");
      const res = await api("/hod/marks-upload", { method: "POST", body: form });
      setReport(res);
      setMode(dryRun ? "preview" : "done");
      if (!dryRun) {
        toast.success(
          `${res.summary.uploaded} mark(s) published to students` +
            (res.summary.held_fees ? ` · ${res.summary.held_fees} held for unpaid fees` : ""),
        );
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
        title="Marks upload (CSV)"
        subtitle={`Upload CA and exam marks for ${auth.lecturer?.department_name || "your department"}. Each row is routed to the student with that matricule and published to them immediately.`}
        actions={
          <Button variant="secondary" icon="download" loading={busy === "template"} onClick={downloadTemplate}>
            Download CSV template
          </Button>
        }
      />

      <Alert tone="info" className="mb-4" title="How it works">
        Prepare a CSV with columns <code>matricule,course_code,ca_mark,exam_mark</code> — one row per
        student per course. Use <strong>Preview</strong> to validate the file without saving anything,
        then <strong>Upload &amp; publish marks</strong>. Students whose fees have not cleared for the
        chosen semester are <strong>not</strong> uploaded: their marks are held back and listed below so
        you can re-upload them after they pay.
      </Alert>

      <Card className="mb-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Academic year" required>
            <Select
              value={yearId}
              onChange={(e) => {
                setYearId(e.target.value);
                setSemesterId("");
              }}
              placeholder="Select academic year…"
              options={years.map((y) => ({ value: y.id, label: y.label }))}
            />
          </Field>
          <Field label="Semester" required>
            <Select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              placeholder={yearId ? "Select semester…" : "Select a year first"}
              disabled={!yearId}
              options={semesters.map((s) => ({
                value: s.id,
                label: `${s.academic_year_label} · ${s.semester_type}`,
              }))}
            />
          </Field>
          <Field label="Marks CSV file" required className="md:col-span-2">
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
              r.balance != null ? formatMoney(r.balance, r.currency || "XAF") : "No invoice",
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

