import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TableCard,
  TextInput,
  useToast,
} from "../components/ui";
import { Icon } from "../components/icons";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useLookup } from "../lib/lookups";
import { formatNumber } from "../lib/format";
import { LinkUserModal } from "./admin-people";

/**
 * Admin → Heads of Department: like the Students section, but for HODs.
 * Department-first: every department shows its current HOD (or "No HOD")
 * with Assign / Change / Remove actions. Assignment grants the scoped
 * `hod` login role; removal revokes it (the person stays a lecturer).
 */
export function HodsPage() {
  const auth = useAuth();
  const toast = useToast();
  const canWrite = auth.has("admin", "super_admin");

  const departmentsReq = useApi("/admin/hods/departments");
  const hodsReq = useApi("/admin/hods");
  const lecturersReq = useApi("/admin/lecturers/?page_size=200");

  const [view, setView] = useState("departments"); // "departments" | "hods"
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(null); // department row
  const [creating, setCreating] = useState(false); // "Add new HOD" modal
  const [removing, setRemoving] = useState(null); // department row
  const [linking, setLinking] = useState(null); // lecturer profile
  const [busy, setBusy] = useState(false);

  const departments = useMemo(
    () => departmentsReq.data?.departments || [],
    [departmentsReq.data],
  );
  const summary = departmentsReq.data?.summary || {};
  const hods = useMemo(() => hodsReq.data?.hods || [], [hodsReq.data]);
  const lecturers = useMemo(
    () => lecturersReq.data?.results || [],
    [lecturersReq.data],
  );

  const visibleDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.department.toLowerCase().includes(q) ||
        (d.hod?.full_name || "").toLowerCase().includes(q) ||
        (d.hod?.lecturer_code || "").toLowerCase().includes(q),
    );
  }, [departments, search]);

  function reloadAll() {
    departmentsReq.reload();
    hodsReq.reload();
    lecturersReq.reload();
  }

  async function removeHod() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/admin/hods/departments/${removing.department_id}`, {
        method: "DELETE",
        body: {},
      });
      toast.success(
        `${removing.hod.full_name} removed as HOD of ${removing.department}. They remain a lecturer.`,
      );
      setRemoving(null);
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Heads of Department"
        subtitle="One HOD per department — just like Students, but for department heads. Add a brand-new HOD, or assign an existing lecturer, to grant department overview and marks-upload access; remove them to revoke it (they stay a lecturer)."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setCreating(true)}>
              Add new HOD
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Departments" value={formatNumber(summary.departments ?? departments.length)} icon="building" />
        <MiniStat label="With an HOD" value={formatNumber(summary.with_hod ?? 0)} icon="cap" tone="good" />
        <MiniStat label="Without an HOD" value={formatNumber(summary.without_hod ?? 0)} icon="alert" tone="warn" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="HOD views">
        {[
          { key: "departments", label: "By department", icon: "building", hint: "Every department & its HOD" },
          { key: "hods", label: "Current HODs", icon: "cap", hint: "Heads only" },
        ].map((option) => {
          const active = view === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(option.key)}
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


      {view === "departments" ? (
        <TableCard
          title="Departments & their HOD"
          subtitle="Assign a head to each department. Changing the HOD replaces the previous head automatically."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                placeholder="Search department or HOD…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              {canWrite ? (
                <Button icon="plus" onClick={() => setCreating(true)}>
                  Add new HOD
                </Button>
              ) : null}
            </div>
          }
        >
          {departmentsReq.loading && !departments.length ? (
            <LoadingState />
          ) : departmentsReq.error ? (
            <div className="p-5">
              <ErrorState error={departmentsReq.error} onRetry={departmentsReq.reload} />
            </div>
          ) : (
            <DataTable
              rowKey={(d) => d.department_id}
              rows={visibleDepartments}
              empty={
                <EmptyState
                  icon="building"
                  title="No departments yet"
                  message="Create departments under Academic structure first, then use “Add new HOD” to head each one."
                  action={
                    canWrite ? (
                      <Button icon="plus" onClick={() => setCreating(true)}>
                        Add new HOD
                      </Button>
                    ) : undefined
                  }
                />
              }
              columns={[
                {
                  key: "department",
                  header: "Department",
                  render: (d) => (
                    <span>
                      <span className="font-medium text-slate-800">{d.department}</span>
                      {d.parent_name ? (
                        <span className="block text-xs text-slate-400">{d.parent_name}</span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: "hod",
                  header: "Head of Department",
                  render: (d) =>
                    d.hod ? (
                      <span>
                        <span className="font-medium text-slate-800">{d.hod.full_name}</span>
                        <span className="block text-xs text-slate-400">
                          {d.hod.lecturer_code}
                          {d.hod.email ? ` · ${d.hod.email}` : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                        No HOD
                      </span>
                    ),
                },
                {
                  key: "login",
                  header: "Login / HOD role",
                  render: (d) =>
                    !d.hod ? (
                      <span className="text-slate-300">—</span>
                    ) : d.hod.has_login ? (
                      <span className={d.hod_role_active ? "font-medium text-brand-700" : "text-amber-600"}>
                        {d.hod_role_active ? "Linked · role active" : "Linked · role inactive"}
                      </span>
                    ) : (
                      <span className="text-amber-600">Not linked</span>
                    ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (d) =>
                    d.hod ? <StatusBadge status={d.hod.status} /> : <span className="text-slate-300">—</span>,
                },
                {
                  key: "__actions",
                  header: "",
                  className: "w-px whitespace-nowrap text-right",
                  render: (d) =>
                    canWrite ? (
                      <div className="flex justify-end gap-1">
                        {d.hod && !d.hod.has_login ? (
                          <Button size="sm" variant="secondary" onClick={() => setLinking(d.hod)}>
                            Link login
                          </Button>
                        ) : null}
                        <Button size="sm" variant="secondary" icon="edit" onClick={() => setAssigning(d)}>
                          {d.hod ? "Change HOD" : "Assign HOD"}
                        </Button>
                        {d.hod ? (
                          <Button size="sm" variant="dangerGhost" icon="x" onClick={() => setRemoving(d)}>
                            Remove HOD
                          </Button>
                        ) : null}
                      </div>
                    ) : null,
                },
              ]}
            />
          )}
        </TableCard>
      ) : (

        <TableCard
          title="Current Heads of Department"
          subtitle="Everyone who currently heads a department."
        >
          {hodsReq.loading && !hods.length ? (
            <LoadingState />
          ) : hodsReq.error ? (
            <div className="p-5">
              <ErrorState error={hodsReq.error} onRetry={hodsReq.reload} />
            </div>
          ) : (
            <DataTable
              rowKey={(h) => h.id}
              rows={hods}
              empty={
                <EmptyState
                  icon="cap"
                  title="No HODs assigned yet"
                  message="Use “Add new HOD” to create the first Head of Department, or assign an existing lecturer from the By department view."
                  action={
                    canWrite ? (
                      <Button icon="plus" onClick={() => setCreating(true)}>
                        Add new HOD
                      </Button>
                    ) : undefined
                  }
                />
              }
              columns={[
                {
                  key: "full_name",
                  header: "HOD",
                  render: (h) => (
                    <span>
                      <span className="font-medium text-slate-800">{h.full_name}</span>
                      <span className="block text-xs text-slate-400">
                        {h.lecturer_code}
                        {h.email ? ` · ${h.email}` : ""}
                      </span>
                    </span>
                  ),
                },
                { key: "department", header: "Department", render: (h) => h.department || "—" },
                {
                  key: "login",
                  header: "Login / HOD role",
                  render: (h) =>
                    h.has_login ? (
                      <span className={h.hod_role_active ? "font-medium text-brand-700" : "text-amber-600"}>
                        {h.hod_role_active ? "Linked · role active" : "Linked · role inactive"}
                      </span>
                    ) : (
                      <span className="text-amber-600">Not linked</span>
                    ),
                },
                { key: "status", header: "Status", render: (h) => <StatusBadge status={h.status} /> },
                {
                  key: "__actions",
                  header: "",
                  className: "w-px whitespace-nowrap text-right",
                  render: (h) =>
                    canWrite ? (
                      <div className="flex justify-end gap-1">
                        {!h.has_login ? (
                          <Button size="sm" variant="secondary" onClick={() => setLinking(h)}>
                            Link login
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="dangerGhost"
                          icon="x"
                          onClick={() =>
                            setRemoving({
                              department_id: h.department_id,
                              department: h.department,
                              hod: h,
                            })
                          }
                        >
                          Remove HOD
                        </Button>
                      </div>
                    ) : null,
                },
              ]}
            />
          )}
        </TableCard>
      )}

      <AssignHodModal
        department={assigning}
        lecturers={lecturers}
        onClose={() => setAssigning(null)}
        onAssigned={reloadAll}
        toast={toast}
      />

      <CreateHodModal
        open={creating}
        departments={departments}
        onClose={() => setCreating(false)}
        onCreated={(createdProfile) => {
          reloadAll();
          if (createdProfile) setLinking(createdProfile);
        }}
        toast={toast}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={removeHod}
        loading={busy}
        danger
        title="Remove Head of Department?"
        message={
          removing
            ? `${removing.hod.full_name} will stop heading ${removing.department}. Their HOD login role is revoked immediately — department overview and marks upload close to them — but they remain a lecturer and keep their login. This is recorded in the audit log.`
            : ""
        }
        confirmLabel="Remove HOD"
      />

      <LinkUserModal
        lecturer={linking}
        onClose={() => setLinking(null)}
        toast={toast}
        onLinked={reloadAll}
      />
    </div>
  );
}

function MiniStat({ label, value, icon, tone = "slate" }) {
  const tones = {
    slate: "text-slate-900",
    good: "text-brand-700",
    warn: "text-amber-600",
  };
  return (
    <Card className="flex items-center gap-3">
      <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
        <Icon name={icon || "chart"} size={20} />
      </span>
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className={`block text-xl font-bold ${tones[tone] || tones.slate}`}>{value}</span>
      </span>
    </Card>
  );
}


function AssignHodModal({ department, lecturers, onClose, onAssigned, toast }) {
  const [lecturerId, setLecturerId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastDepartment, setLastDepartment] = useState(undefined);

  if (department !== lastDepartment) {
    setLastDepartment(department);
    setLecturerId(department?.hod ? String(department.hod.id) : "");
    setReason("");
    setError("");
  }
  if (!department) return null;

  const currentHodId = department.hod?.id;
  const options = (lecturers || [])
    .filter((l) => l.status === "active")
    .map((l) => {
      const headsOther =
        l.is_hod && l.department && String(l.department) !== String(department.department_id);
      return {
        value: l.id,
        disabled: Boolean(headsOther),
        label:
          `${l.full_name} (${l.lecturer_code})` +
          (String(l.department) === String(department.department_id)
            ? " · this department"
            : l.department_name
              ? ` · ${l.department_name}`
              : " · no department") +
          (headsOther ? " · already HOD elsewhere" : "") +
          (l.id === currentHodId ? " · current HOD" : ""),
      };
    });

  async function submit(e) {
    e.preventDefault();
    if (!lecturerId) {
      setError("Choose a lecturer to head this department.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api(`/admin/hods/departments/${department.department_id}`, {
        method: "POST",
        body: { lecturer_id: Number(lecturerId), reason: reason.trim() },
      });
      toast.success(
        res.previous_hod
          ? `${res.hod.full_name} now heads ${department.department} (replaced ${res.previous_hod.full_name}).`
          : `${res.hod.full_name} is now Head of ${department.department}.`,
      );
      onClose();
      onAssigned?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${department.hod ? "Change" : "Assign"} HOD — ${department.department}`}
      subtitle={
        department.hod
          ? `Current head: ${department.hod.full_name}. Choosing someone else replaces them automatically.`
          : "This department has no head yet."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="assign-hod-form" loading={saving}>
            {department.hod ? "Change HOD" : "Assign HOD"}
          </Button>
        </>
      }
    >
      <form id="assign-hod-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <Alert tone="info">
          The lecturer becomes the single Head of {department.department}: they get the{" "}
          <strong>hod</strong> login role scoped to this department (department overview + marks
          upload). Lecturers who already head another department must be removed there first. If
          the lecturer has no login linked yet, link it afterwards from this page.
        </Alert>
        <Field label="Lecturer" required>
          <Select
            value={lecturerId}
            onChange={(e) => setLecturerId(e.target.value)}
            placeholder={options.length ? "Select a lecturer…" : "No active lecturers available"}
            options={options}
            required
          />
        </Field>
        <Field label="Reason (optional, audited)">
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Departmental rotation for 2026/2027"
          />
        </Field>
      </form>
    </Modal>
  );
}


function CreateHodModal({ open, departments, onClose, onCreated, toast }) {
  const units = useLookup("units");
  const [form, setForm] = useState({
    department_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    lecturer_code: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);

  // Reset the form each time the modal is opened.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const withoutHod = (departments || []).find((d) => !d.has_hod);
      setForm({
        department_id: withoutHod ? String(withoutHod.department_id) : "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        lecturer_code: "",
        reason: "",
      });
      setError("");
    }
  }
  if (!open) return null;

  const departmentRows = (departments || []).length
    ? departments
    : (units || [])
        .filter((u) => u.unit_type === "department")
        .map((u) => ({ department_id: u.id, department: u.name, has_hod: false, hod: null }));
  const options = departmentRows.map((d) => ({
    value: d.department_id,
    label: d.hod
      ? `${d.department} — current HOD: ${d.hod.full_name} (will be replaced)`
      : `${d.department} — no HOD yet`,
  }));
  const chosen = departmentRows.find(
    (d) => String(d.department_id) === String(form.department_id),
  );
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.department_id) {
      setError("Choose the department the new HOD will head.");
      return;
    }
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api("/admin/hods/create", {
        method: "POST",
        body: {
          department_id: Number(form.department_id),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          lecturer_code: form.lecturer_code.trim(),
          reason: form.reason.trim(),
        },
      });
      toast.success(
        `${res.hod.full_name} (${res.hod.lecturer_code}) is now Head of ${res.department}. Link their login account so they can sign in.`,
      );
      onClose();
      onCreated?.(res.hod);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }


  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Add new HOD"
      subtitle="Creates a new lecturer and makes them Head of the chosen department in one step."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-hod-form" loading={saving} icon="plus">
            Add new HOD
          </Button>
        </>
      }
    >
      <form id="create-hod-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <Alert tone="info">
          This creates a brand-new lecturer profile and immediately makes them the single Head of
          the department (replacing any current head). To make an <strong>existing</strong>{" "}
          lecturer the head instead, close this and use <strong>Assign HOD</strong> on the
          department's row. After creating, you will be asked to link their login account.
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department to head" required className="sm:col-span-2">
            <Select
              value={form.department_id}
              onChange={(e) => set("department_id", e.target.value)}
              placeholder={options.length ? "Select a department…" : "No departments exist yet"}
              options={options}
              required
            />
          </Field>
          {chosen?.hod ? (
            <p className="text-sm text-amber-700 sm:col-span-2">
              {chosen.department} is currently headed by {chosen.hod.full_name}; the new HOD will
              replace them (they stay a lecturer).
            </p>
          ) : null}
          <Field label="First name" required>
            <TextInput
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              placeholder="e.g. Mary"
              required
            />
          </Field>
          <Field label="Last name" required>
            <TextInput
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              placeholder="e.g. Maths"
              required
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="mary.maths@university.edu"
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+237…"
            />
          </Field>
          <Field
            label="Lecturer code"
            hint="Leave blank and the system generates the next code (e.g. LEC-102)."
            className="sm:col-span-2"
          >
            <TextInput
              value={form.lecturer_code}
              onChange={(e) => set("lecturer_code", e.target.value)}
              placeholder="Auto-generated if blank"
              className="font-mono"
            />
          </Field>
          <Field label="Reason (optional, audited)" className="sm:col-span-2">
            <TextInput
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="e.g. New Head of Department for 2026/2027"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

