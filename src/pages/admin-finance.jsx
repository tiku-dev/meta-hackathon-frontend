import { useState } from "react";
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
  StatusBadge,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useLookup } from "../lib/lookups";
import { formatDateTime, formatMoney } from "../lib/format";

const feeFields = [
  {
    name: "fee_type",
    label: "Fee type",
    required: true,
    type: "select",
    options: [
      { value: "registration", label: "Tuition / semester fees (registration threshold)" },
      { value: "registration_fee", label: "One-time registration fee (new students, paid once)" },
      { value: "tuition", label: "Tuition" },
      { value: "other", label: "Other" },
    ],
    hint: "“One-time registration fee” is charged once to NEW students before any fee payment; the DB records who has paid so it is never charged twice.",
  },
  { name: "amount", label: "Amount", type: "number", required: true, min: 0, step: "0.01" },
  {
    name: "currency",
    label: "Currency",
    type: "select",
    options: [
      { value: "USD", label: "USD ($)" },
      { value: "XAF", label: "XAF" },
    ],
  },
  {
    name: "registration_threshold_type",
    label: "Registration threshold",
    type: "select",
    options: [
      { value: "percent", label: "Percent of invoice" },
      { value: "amount", label: "Fixed amount" },
    ],
  },
  { name: "registration_threshold_value", label: "Threshold value", type: "number", min: 0, step: "0.01", hint: "Percent or fixed amount that must be verified-paid before registration." },
  { name: "academic_unit", label: "Academic unit scope", type: "lookup", lookup: "units" },
  { name: "program", label: "Program scope", type: "lookup", lookup: "programs" },
  { name: "level", label: "Level scope", type: "lookup", lookup: "levels" },
  { name: "academic_year", label: "Academic year scope", type: "lookup", lookup: "years" },
  { name: "semester", label: "Semester scope", type: "lookup", lookup: "semesters", optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
  { name: "student_category", label: "Student category (blank = all)", placeholder: "regular" },
  { name: "effective_from", label: "Effective from", type: "date" },
  { name: "effective_to", label: "Effective to", type: "date" },
  { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active schedule" },
];

const invoiceFields = [
  { name: "student", label: "Student", type: "lookup", lookup: "students", required: true, optionLabel: (r) => `${r.matricule || "—"} — ${r.full_name}` },
  { name: "fee_schedule", label: "Fee schedule", type: "lookup", lookup: "feeSchedules", optionLabel: (r) => `${r.fee_type} · ${r.amount} ${r.currency}` },
  { name: "semester", label: "Semester", type: "lookup", lookup: "semesters", required: true, optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
  { name: "academic_year", label: "Academic year", type: "lookup", lookup: "years" },
  { name: "total_due", label: "Total due", type: "number", required: true, min: 0, step: "0.01" },
  {
    name: "currency",
    label: "Currency",
    type: "select",
    options: [
      { value: "USD", label: "USD ($)" },
      { value: "XAF", label: "XAF" },
    ],
  },
  { name: "due_date", label: "Due date", type: "datetime" },
  { name: "alt_currency", label: "Alternate currency", placeholder: "USD" },
  { name: "alt_amount", label: "Alternate amount", type: "number", min: 0, step: "0.01" },
  { name: "fx_rate", label: "FX rate used", type: "number", min: 0, step: "0.0001" },
  { name: "notes", label: "Notes", type: "textarea", span: 2 },
];

const adjustmentFields = [
  { name: "invoice", label: "Invoice ID", type: "number", required: true, hint: "Use the invoice number from the Invoices tab." },
  { name: "amount", label: "Amount", type: "number", required: true, min: 0, step: "0.01" },
  {
    name: "currency",
    label: "Currency",
    type: "select",
    options: [
      { value: "USD", label: "USD ($)" },
      { value: "XAF", label: "XAF" },
    ],
  },
  { name: "method", label: "Method", required: true, placeholder: "cash / bank transfer / …" },
  { name: "evidence", label: "Evidence reference", placeholder: "receipt no., file path…" },
  { name: "reason", label: "Reason", type: "textarea", required: true, span: 2 },
];

const tabs = [
  { key: "fees", label: "Fee schedules" },
  { key: "invoices", label: "Invoices" },
  { key: "offline", label: "Offline payments" },
  { key: "reconciliation", label: "Reconciliation" },
];

export function FinancePage() {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("fees");
  const canWrite = auth.has("admin", "super_admin", "finance");
  const students = useLookup("students");
  const semesters = useLookup("semesters");
  const [gen, setGen] = useState({ student_id: "", semester_id: "" });
  const [generating, setGenerating] = useState(false);
  const [listEpoch, setListEpoch] = useState(0);

  async function generateInvoice() {
    if (!gen.student_id || !gen.semester_id) {
      toast.error("Choose a student and a semester first.");
      return;
    }
    setGenerating(true);
    try {
      const inv = await api("/admin/invoices/generate/", {
        method: "POST",
        body: { student_id: Number(gen.student_id), semester_id: Number(gen.semester_id) },
      });
      toast.success(`Invoice #${inv.id} ready — ${formatMoney(inv.total_due, inv.currency)} due.`);
      setListEpoch((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function waive(row, ctx) {
    try {
      await api(`/admin/invoices/${row.id}/waive/`, { method: "POST", body: { reason: "Waived from finance UI" } });
      toast.success(`Invoice #${row.id} waived.`);
      ctx.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function decide(row, approve, ctx) {
    try {
      await api(`/admin/offline-adjustments/${row.id}/${approve ? "approve" : "reject"}/`, {
        method: "POST",
        body: { reason: "" },
      });
      toast.success(approve ? "Offline payment approved and credited." : "Offline payment rejected.");
      ctx.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const feeResource = {
    title: "Fee schedules",
    subtitle: "The most specific active schedule wins (program+level > program > unit > university). Amounts are configuration.",
    path: "/admin/fee-schedules/",
    singular: "Fee schedule",
    canWrite,
    fields: feeFields,
    filters: [
      { name: "program", label: "All programs", lookup: "programs" },
      { name: "is_active", label: "Active?", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
    ],
    columns: [
      { key: "fee_type", header: "Type", render: (f) => <span className="font-medium text-slate-800">{f.fee_type}</span> },
      { key: "amount", header: "Amount", render: (f) => formatMoney(f.amount, f.currency) },
      {
        key: "scope",
        header: "Scope",
        render: (f, ctx) =>
          f.program
            ? ctx.label(ctx.lookups.programs, f.program)
            : f.academic_unit
              ? ctx.label(ctx.lookups.units, f.academic_unit)
              : "University-wide",
      },
      { key: "threshold", header: "Gate", render: (f) => `${f.registration_threshold_value} ${f.registration_threshold_type === "percent" ? "%" : f.currency}` },
      { key: "is_active", header: "Active", render: (f) => (f.is_active ? "Yes" : "No") },
    ],
  };

  const invoiceResource = {
    title: "Invoices",
    subtitle: "Generate from a fee schedule above, or manage invoices directly. Waiving is audited.",
    path: "/admin/invoices/",
    singular: "Invoice",
    canWrite,
    fields: invoiceFields,
    filters: [
      { name: "status", label: "All statuses", options: ["unpaid", "partially_paid", "paid", "overdue", "waived", "cancelled"].map((v) => ({ value: v, label: v })) },
      { name: "student", label: "All students", lookup: "students", optionLabel: (r) => `${r.matricule || "—"} — ${r.full_name}` },
      { name: "semester", label: "All semesters", lookup: "semesters", optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
    ],
    columns: [
      { key: "id", header: "Invoice", render: (i) => <span className="font-mono text-xs font-bold">#{i.id}</span> },
      {
        key: "student",
        header: "Student",
        render: (i) => (
          <span>
            <span className="font-medium text-slate-800">{i.student_name}</span>
            <span className="block font-mono text-[11px] text-slate-400">{i.student_matricule}</span>
          </span>
        ),
      },
      { key: "total_due", header: "Due", render: (i) => formatMoney(i.total_due, i.currency) },
      { key: "amount_paid", header: "Paid", render: (i) => formatMoney(i.amount_paid, i.currency) },
      { key: "balance", header: "Balance", render: (i) => <span className="font-semibold">{formatMoney(i.balance, i.currency)}</span> },
      { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
    ],
    actions: (row, ctx) =>
      canWrite && row.status !== "waived" && row.status !== "paid" ? (
        <Button size="sm" variant="secondary" onClick={() => waive(row, ctx)}>Waive</Button>
      ) : null,
  };

  const offlineResource = {
    title: "Offline payment adjustments",
    subtitle: "Cash/bank payments recorded with evidence. Approval credits the invoice; both steps are audited.",
    path: "/admin/offline-adjustments/",
    singular: "Adjustment",
    canWrite,
    fields: adjustmentFields,
    filters: [{ name: "status", label: "All statuses", options: [
      { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
    ]}],
    columns: [
      { key: "invoice", header: "Invoice", render: (a) => `#${a.invoice}` },
      { key: "amount", header: "Amount", render: (a) => formatMoney(a.amount, a.currency) },
      { key: "method", header: "Method" },
      { key: "reason", header: "Reason", render: (a) => <span className="line-clamp-2 text-slate-500">{a.reason}</span> },
      { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
    ],
    actions: (row, ctx) =>
      canWrite && row.status === "pending" ? (
        <>
          <Button size="sm" onClick={() => decide(row, true, ctx)}>Approve</Button>
          <Button size="sm" variant="dangerGhost" onClick={() => decide(row, false, ctx)}>Reject</Button>
        </>
      ) : null,
  };



  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Fees are configuration. Online credit is granted only after server-side provider verification; offline payments need recorded evidence plus approval."
      />
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl bg-slate-200/60 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === t.key ? "bg-white text-brand-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fees" ? <ResourcePage resource={feeResource} /> : null}

      {tab === "invoices" ? (
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-slate-900">Generate invoice from fee schedule</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Creates (or returns) the student's invoice for a semester using the most specific active schedule.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <Field label="Student">
                <Select
                  value={gen.student_id}
                  onChange={(e) => setGen((s) => ({ ...s, student_id: e.target.value }))}
                  placeholder="Select student…"
                  options={students.map((s) => ({ value: s.id, label: `${s.matricule || "—"} — ${s.full_name}` }))}
                />
              </Field>
              <Field label="Semester">
                <Select
                  value={gen.semester_id}
                  onChange={(e) => setGen((s) => ({ ...s, semester_id: e.target.value }))}
                  placeholder="Select semester…"
                  options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_label} · ${s.semester_type}` }))}
                />
              </Field>
              <Button loading={generating} onClick={generateInvoice} icon="plus">
                Generate invoice
              </Button>
            </div>
          </Card>
          <div key={listEpoch}>
            <ResourcePage resource={invoiceResource} />
          </div>
        </div>
      ) : null}

      {tab === "offline" ? <ResourcePage resource={offlineResource} /> : null}
      {tab === "reconciliation" ? <ReconciliationTab toast={toast} /> : null}
    </div>
  );
}

function ReconciliationTab({ toast }) {
  const rec = useApi("/admin/payments/reconciliation");
  const [checking, setChecking] = useState("");

  async function check(reference) {
    setChecking(reference);
    try {
      const attempt = await api(`/payments/${encodeURIComponent(reference)}/status`);
      toast.info(`${reference}: ${attempt.status}`);
      rec.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChecking("");
    }
  }

  if (rec.loading) return <LoadingState label="Loading reconciliation queue…" />;
  if (rec.error) return <ErrorState error={rec.error} onRetry={rec.reload} />;

  const pending = rec.data?.pending || [];
  const needsReview = rec.data?.needs_review || [];
  const stale = new Set(rec.data?.stale_pending_over_15min || []);

  const columns = [
    { key: "reference", header: "Reference", render: (a) => <span className="break-all font-mono text-[11px] font-semibold">{a.reference}</span> },
    { key: "provider", header: "Provider" },
    { key: "amount", header: "Amount", render: (a) => formatMoney(a.amount, a.currency) },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
    { key: "created_at", header: "Started", render: (a) => formatDateTime(a.created_at) },
    {
      key: "__check",
      header: "",
      className: "text-right",
      render: (a) => (
        <Button size="sm" variant="secondary" loading={checking === a.reference} onClick={() => check(a.reference)}>
          Verify now
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {stale.size ? (
        <Alert tone="warning" title={`${stale.size} attempt(s) pending over 15 minutes`}>
          Stale references: {[...stale].join(", ")}. Use “Verify now” — the server re-checks with the provider.
        </Alert>
      ) : null}
      <Card pad={false} className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Needs review</h2>
          <p className="text-xs text-slate-500">Amount/currency mismatches park here and never auto-credit.</p>
        </div>
        <DataTable columns={columns} rows={needsReview} empty={<EmptyState icon="check" title="Nothing needs review" />} />
      </Card>
      <Card pad={false} className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Pending / created</h2>
          <p className="text-xs text-slate-500">Waiting for provider confirmation (checkout, webhook or status check).</p>
        </div>
        <DataTable columns={columns} rows={pending} empty={<EmptyState icon="clock" title="No pending attempts" />} />
      </Card>
    </div>
  );
}

