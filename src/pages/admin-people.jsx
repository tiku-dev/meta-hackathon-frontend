import { useRef, useState } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  Modal,
  PageHeader,
  StatusBadge,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { invalidateLookups } from "../lib/lookups";
import { formatDate } from "../lib/format";

/* ------------------------------- Students ------------------------------- */

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const studentFields = [
  { name: "first_name", label: "First name", required: true },
  { name: "last_name", label: "Last name", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "date_of_birth", label: "Date of birth", type: "date" },
  {
    name: "gender",
    label: "Gender",
    type: "select",
    required: true,
    options: GENDER_OPTIONS,
  },
  { name: "address", label: "Address", span: 2 },
  { name: "program", label: "Program", type: "lookup", lookup: "programs" },
  { name: "current_level", label: "Current level", type: "lookup", lookup: "levels" },
  { name: "admission_year", label: "Admission year", type: "lookup", lookup: "years" },
  { name: "student_category", label: "Student category", placeholder: "regular" },
];

export function StudentsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [issued, setIssued] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [csvResult, setCsvResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const canWrite = auth.has("admin", "super_admin", "admissions");

  async function issue(row, list) {
    try {
      const res = await api(`/admin/students/${row.id}/issue-matricule/`, { method: "POST", body: {} });
      setIssued({ ...res, student: row });
      toast.success(`Matricule issued to ${row.full_name}.`);
      list?.reload?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function revoke() {
    if (!revoking) return;
    try {
      await api(`/admin/students/${revoking.id}/revoke/`, { method: "POST", body: { reason: "" } });
      toast.success("Student revoked. The matricule can never be reused.");
      setRevoking(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function importCsv(file) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setImporting(true);
    try {
      const res = await api("/admin/students/import-csv/", { method: "POST", body: form });
      setCsvResult(res);
      toast.success(`Imported ${res.created?.length || 0} student(s), ${res.errors?.length || 0} error(s).`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        title="Students & matricules"
        subtitle="Create a student prospect and the server issues a unique matricule plus a one-time activation code (shown once — only its hash is stored). CSV import does the same per row."
        actions={
          canWrite ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => importCsv(e.target.files?.[0])}
              />
              <Button variant="secondary" icon="upload" loading={importing} onClick={() => fileRef.current?.click()}>
                Import CSV
              </Button>
            </>
          ) : null
        }
      />

      <ResourcePage
        resource={{
          title: "Students",
          subtitle: "Prospects stay 'pending' until the student claims the activation code.",
          path: "/admin/students/",
          singular: "Student",
          canWrite,
          fields: studentFields,
          onSaved: () => invalidateLookups("students"),
          filters: [
            {
              name: "status",
              label: "All statuses",
              options: [
                { value: "pending", label: "Pending activation" },
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
                { value: "graduated", label: "Graduated" },
                { value: "withdrawn", label: "Withdrawn" },
              ],
            },
            { name: "program", label: "All programs", lookup: "programs" },
          ],
          columns: [
            { key: "matricule", header: "Matricule", render: (s) => <span className="font-mono text-xs font-bold">{s.matricule || "—"}</span> },
            {
              key: "full_name",
              header: "Student",
              render: (s) => (
                <span>
                  <span className="font-medium text-slate-800">{s.full_name}</span>
                  <span className="block text-xs text-slate-400">{s.email}</span>
                </span>
              ),
            },
            { key: "program_name", header: "Program", render: (s) => s.program_name || "—" },
            { key: "level_label", header: "Level", render: (s) => s.level_label || "—" },
            { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
            { key: "created_at", header: "Created", render: (s) => formatDate(s.created_at) },
          ],
          actions: (row, ctx) =>
            canWrite ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => issue(row, ctx)}>
                  {row.matricule ? "Re-issue code" : "Issue matricule"}
                </Button>
                <Button size="sm" variant="dangerGhost" onClick={() => setRevoking(row)}>
                  Revoke
                </Button>
              </>
            ) : null,
        }}
      />

      <Modal
        open={Boolean(issued)}
        onClose={() => setIssued(null)}
        title="Activation details — shown once"
        subtitle={issued ? `${issued.student?.full_name || ""} · ${issued.matricule || ""}` : ""}
        footer={<Button onClick={() => setIssued(null)}>Done</Button>}
      >
        {issued ? (
          <div className="space-y-3 text-sm">
            <Alert tone="warning">
              Copy these now. Only a hash of the code is stored, so it cannot be shown again —
              re-issuing invalidates this code.
            </Alert>
            <CopyRow label="Matricule" value={issued.matricule} mono />
            <CopyRow label="Activation code" value={issued.activation_token} mono />
            <CopyRow label="Activation link" value={issued.activation_link} />
            <p className="text-xs text-slate-400">
              Expires {issued.expires_at ? new Date(issued.expires_at).toLocaleString() : "per university policy"}.
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        danger
        title="Revoke this student?"
        message={`This blocks login and future activation for ${revoking?.full_name || "the student"}. The matricule ${revoking?.matricule || ""} is never reused.`}
        confirmLabel="Revoke student"
      />

      <Modal open={Boolean(csvResult)} onClose={() => setCsvResult(null)} wide title="CSV import result" footer={<Button onClick={() => setCsvResult(null)}>Close</Button>}>
        {csvResult ? (
          <div className="space-y-4 text-sm">
            <Alert tone={csvResult.errors?.length ? "warning" : "success"}>
              Created {csvResult.created?.length || 0} student(s)
              {csvResult.errors?.length ? `, ${csvResult.errors.length} row(s) failed` : ""}. Activation
              codes are listed below — shown once.
            </Alert>
            {(csvResult.created || []).map((c) => (
              <CopyRow key={c.id} label={c.matricule} value={c.activation_token} mono />
            ))}
            {(csvResult.errors || []).map((e, i) => (
              <p key={i} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                Row {e.row}: {e.error}
              </p>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function CopyRow({ label, value, mono = false }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex gap-2">
        <code className={`min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200 ${mono ? "font-mono" : ""}`}>
          {value}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            toast.success(`${label} copied.`);
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Lecturers ------------------------------- */

const lecturerFields = [
  { name: "lecturer_code", label: "Lecturer code", required: true, placeholder: "e.g. LEC-001" },
  { name: "first_name", label: "First name", required: true },
  { name: "last_name", label: "Last name", required: true },
  { name: "email", label: "Email (invitation/display)" },
  { name: "phone", label: "Phone" },
  { name: "department", label: "Department", type: "lookup", lookup: "units" },
  { name: "is_hod", label: "Heads department", type: "checkbox", checkboxLabel: "This lecturer is the HOD" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
];

export function LecturersPage() {
  const auth = useAuth();
  const toast = useToast();
  const [linking, setLinking] = useState(null);
  const canWrite = auth.has("admin", "super_admin");
  const canLink = canWrite;

  return (
    <div>
      <PageHeader
        title="Lecturers"
        subtitle="Lecturer records come first; then link an existing login account (by user ID) to grant the lecturer — and, for department heads, HOD — role."
      />
      <ResourcePage
        resource={{
          title: "Lecturers",
          path: "/admin/lecturers/",
          singular: "Lecturer",
          canWrite,
          fields: lecturerFields,
          onSaved: () => invalidateLookups("lecturers"),
          filters: [
            { name: "department", label: "All departments", lookup: "units" },
            {
              name: "is_hod",
              label: "HOD filter",
              options: [
                { value: "true", label: "Heads of department" },
                { value: "false", label: "Not HOD" },
              ],
            },
          ],
          columns: [
            { key: "lecturer_code", header: "Code", render: (l) => <span className="font-mono text-xs font-bold">{l.lecturer_code}</span> },
            {
              key: "full_name",
              header: "Lecturer",
              render: (l) => (
                <span>
                  <span className="font-medium text-slate-800">{l.full_name}</span>
                  <span className="block text-xs text-slate-400">{l.email || "—"}</span>
                </span>
              ),
            },
            { key: "department_name", header: "Department", render: (l) => l.department_name || "—" },
            { key: "is_hod", header: "HOD", render: (l) => (l.is_hod ? <span className="font-semibold text-brand-700">Head</span> : "—") },
            { key: "user", header: "Login linked", render: (l) => (l.user ? `#${l.user}` : <span className="text-amber-600">Not linked</span>) },
            { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
          ],
          actions: (row) =>
            canLink ? (
              <Button size="sm" variant="secondary" onClick={() => setLinking(row)}>
                {row.user ? "Re-link user" : "Link user"}
              </Button>
            ) : null,
        }}
      />

      <LinkUserModal lecturer={linking} onClose={() => setLinking(null)} toast={toast} />
    </div>
  );
}

export function LinkUserModal({ lecturer, onClose, toast, onLinked }) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastLecturer, setLastLecturer] = useState(undefined);
  if (lecturer !== lastLecturer) {
    setLastLecturer(lecturer);
    setUserId(lecturer?.user ? String(lecturer.user) : "");
  }
  if (!lecturer) return null;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/admin/lecturers/${lecturer.id}/assign-user/`, {
        method: "POST",
        body: { user_id: Number(userId) },
      });
      toast.success("Login account linked. The lecturer role was granted.");
      onClose();
      onLinked?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Link login — ${lecturer.full_name}`}
      subtitle="The account must already exist (user logs in with email + password)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="link-user-form" loading={saving}>Link account</Button>
        </>
      }
    >
      <form id="link-user-form" onSubmit={submit} className="space-y-3">
        <Alert tone="info">
          Enter the numeric user ID of the login account. Create staff accounts via seeded demo
          users or Django admin; this endpoint only links and grants roles.
        </Alert>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">User ID</span>
          <input
            type="number"
            min="1"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="e.g. 12"
          />
        </label>
        {lecturer.is_hod ? (
          <p className="text-sm text-slate-500">
            Because this lecturer heads a department, the HOD role (scoped to the department) is granted too.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}



