import { useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { useAuth } from "../lib/auth";
import { api, downloadFile } from "../lib/api";
import { useApi } from "../lib/hooks";
import { invalidateLookups } from "../lib/lookups";
import { formatDateTime, formatMoney } from "../lib/format";

/* ------------------------- Grading & transcripts ------------------------ */

const policyFields = [
  { name: "name", label: "Policy name", required: true, span: 2 },
  { name: "academic_unit", label: "Academic unit scope", type: "lookup", lookup: "units" },
  { name: "program", label: "Program scope", type: "lookup", lookup: "programs" },
  { name: "academic_year", label: "Academic year scope", type: "lookup", lookup: "years" },
  { name: "ca_max", label: "CA maximum", type: "number", min: 0, step: "0.01" },
  { name: "exam_max", label: "Exam maximum", type: "number", min: 0, step: "0.01" },
  { name: "pass_mark", label: "Pass mark", type: "number", min: 0, step: "0.01" },
  { name: "rounding_places", label: "Rounding places", type: "number", min: 0 },
  { name: "gpa_scale", label: "GPA scale", type: "number", min: 0, step: "0.01" },
  { name: "gpa_weighted_by_credits", label: "GPA weighting", type: "checkbox", checkboxLabel: "Weight GPA by credits" },
  { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active policy" },
];

const bandFields = [
  { name: "policy", label: "Grading policy", type: "lookup", lookup: "gradingPolicies", required: true },
  { name: "letter", label: "Letter", required: true, placeholder: "A" },
  { name: "min_score", label: "Min score", type: "number", required: true, step: "0.01" },
  { name: "max_score", label: "Max score", type: "number", required: true, step: "0.01" },
  { name: "points", label: "Grade points", type: "number", step: "0.01" },
  { name: "label", label: "Label", placeholder: "Excellent" },
  { name: "is_pass", label: "Pass band", type: "checkbox", checkboxLabel: "Counts as pass" },
];

const resultTabs = [
  { key: "policies", label: "Grading policies" },
  { key: "bands", label: "Grade bands" },
  { key: "transcripts", label: "Transcript requests" },
];

export function ResultsAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("policies");
  const canWrite = auth.has("admin", "super_admin", "registrar");

  async function issue(row, ctx) {
    try {
      const res = await api(`/admin/transcripts/${row.id}/issue/`, { method: "POST", body: {} });
      toast.success(`Official transcript issued: ${res.issue_number}.`);
      ctx.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const resources = {
    policies: {
      title: "Grading policies",
      subtitle: "CA/exam maxima, pass mark, rounding and GPA rules — the most specific active policy applies.",
      path: "/admin/grading-policies/",
      singular: "Policy",
      canWrite,
      fields: policyFields,
      onSaved: () => invalidateLookups("gradingPolicies"),
      filters: [{ name: "is_active", label: "Active?", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }],
      columns: [
        { key: "name", header: "Policy", render: (p) => <span className="font-medium text-slate-800">{p.name}</span> },
        { key: "maxima", header: "CA / Exam", render: (p) => `${p.ca_max} / ${p.exam_max}` },
        { key: "pass_mark", header: "Pass mark" },
        { key: "gpa_scale", header: "GPA scale" },
        { key: "bands", header: "Bands", render: (p) => (p.bands || []).length },
        { key: "is_active", header: "Active", render: (p) => (p.is_active ? "Yes" : "No") },
      ],
    },
    bands: {
      title: "Grade bands",
      subtitle: "Score ranges mapped to letters and GPA points within a policy.",
      path: "/admin/grade-bands/",
      singular: "Grade band",
      canWrite,
      fields: bandFields,
      filters: [{ name: "policy", label: "All policies", lookup: "gradingPolicies" }],
      columns: [
        { key: "letter", header: "Letter", render: (b) => <span className="font-bold">{b.letter}</span> },
        { key: "range", header: "Range", render: (b) => `${b.min_score} – ${b.max_score}` },
        { key: "points", header: "Points" },
        { key: "label", header: "Label", render: (b) => b.label || "—" },
        { key: "is_pass", header: "Pass", render: (b) => (b.is_pass ? "Yes" : "No") },
        { key: "policy", header: "Policy", render: (b, ctx) => ctx.label(ctx.lookups.policies, b.policy) },
      ],
    },
    transcripts: {
      title: "Transcript requests",
      subtitle: "Students request transcripts; registrars issue official ones with an issue number.",
      path: "/admin/transcripts/",
      singular: "Transcript request",
      canWrite,
      fields: [
        { name: "student", label: "Student", type: "lookup", lookup: "students", required: true, optionLabel: (r) => `${r.matricule || "—"} — ${r.full_name}` },
        { name: "is_official", label: "Official", type: "checkbox", checkboxLabel: "Official transcript" },
      ],
      filters: [
        { name: "status", label: "All statuses", options: ["requested", "approved", "issued", "rejected"].map((v) => ({ value: v, label: v })) },
        { name: "student", label: "All students", lookup: "students", optionLabel: (r) => `${r.matricule || "—"} — ${r.full_name}` },
      ],
      columns: [
        { key: "id", header: "Request", render: (t) => `#${t.id}` },
        {
          key: "student",
          header: "Student",
          render: (t) => (
            <span>
              <span className="font-medium text-slate-800">{t.student_name}</span>
              <span className="block font-mono text-[11px] text-slate-400">{t.student_matricule}</span>
            </span>
          ),
        },
        { key: "is_official", header: "Type", render: (t) => (t.is_official ? "Official" : "Unofficial") },
        { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
        { key: "issue_number", header: "Issue №", render: (t) => t.issue_number || "—" },
        { key: "created_at", header: "Requested", render: (t) => formatDateTime(t.created_at) },
      ],
      actions: (row, ctx) => (
        <>
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={() => downloadFile(`/admin/transcripts/${row.id}/download/`, `transcript-${row.id}.pdf`)}
          >
            PDF
          </Button>
          {canWrite && row.status !== "issued" ? (
            <Button size="sm" onClick={() => issue(row, ctx)}>Issue official</Button>
          ) : null}
        </>
      ),
    },
  };

  return (
    <div>
      <PageHeader
        title="Grading & transcripts"
        subtitle="Configure how marks become grades and GPA, then manage transcript requests. Students download drafts themselves; only issued transcripts are official."
      />
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl bg-slate-200/60 p-1.5">
        {resultTabs.map((t) => (
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
      <div key={tab}>
        <ResourcePage resource={resources[tab]} />
      </div>
    </div>
  );
}

/* -------------------------------- Reports -------------------------------- */

const REPORTS = [
  { key: "students", label: "Students", description: "Totals by activation status." },
  { key: "fee-balances", label: "Fee balances", description: "Billed vs collected across invoices." },
  { key: "payments", label: "Payments", description: "Attempts by status and provider." },
  { key: "registrations", label: "Registrations", description: "Active registrations per course." },
  { key: "results", label: "Results", description: "Published results and pass rate." },
];

export function ReportsPage() {
  const toast = useToast();
  const [active, setActive] = useState("students");
  const report = useApi(`/admin/reports/${active}`, { deps: [active] });

  async function exportCsv() {
    try {
      await downloadFile(`/admin/reports/${active}?export=csv`, `${active}-report.csv`);
      toast.success("CSV export downloaded.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Operational summaries computed live from the database. Export any report as CSV."
        actions={
          <Button icon="download" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl bg-slate-200/60 p-1.5">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
              active === r.key ? "bg-white text-brand-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-slate-500">{REPORTS.find((r) => r.key === active)?.description}</p>

      {report.loading ? (
        <LoadingState label="Building report…" />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={report.reload} />
      ) : (
        <ReportBody reportKey={active} data={report.data || {}} />
      )}
    </div>
  );
}

function StatGrid({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ReportBody({ reportKey, data }) {
  if (reportKey === "students") {
    return (
      <div className="space-y-4">
        <StatGrid items={[["Total students", data.total ?? 0]]} />
        <BreakdownTable title="By status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
      </div>
    );
  }
  if (reportKey === "fee-balances") {
    const currencies = Object.entries(data.by_currency || {});
    return (
      <div className="space-y-4">
        <StatGrid
          items={[
            ["Invoices", data.invoice_count ?? 0],
            ["Total due", formatMoney(data.total_due)],
            ["Total paid", formatMoney(data.total_paid)],
          ]}
        />
        {currencies.length ? (
          <BreakdownTable
            title="By currency"
            rows={currencies.map(([cur, v]) => ({ label: cur, count: `${formatMoney(v.total_paid, cur)} of ${formatMoney(v.total_due, cur)}` }))}
          />
        ) : null}
        <BreakdownTable title="By status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
      </div>
    );
  }
  if (reportKey === "payments") {
    return (
      <div className="space-y-4">
        <StatGrid items={[["Attempts", data.total ?? 0], ["Succeeded amount", formatMoney(data.succeeded_amount)]]} />
        <BreakdownTable title="By status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
        <BreakdownTable title="By provider" rows={(data.by_provider || []).map((r) => ({ label: r.provider, count: r.count }))} />
      </div>
    );
  }
  if (reportKey === "registrations") {
    return (
      <div className="space-y-4">
        <StatGrid items={[["Total", data.total ?? 0], ["Active", data.active ?? 0]]} />
        <BreakdownTable
          title="Top courses by registrations"
          rows={(data.by_course || []).map((r) => ({ label: r["offering__course__code"], count: r.count }))}
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <StatGrid
        items={[
          ["Results", data.total ?? 0],
          ["Published", data.published ?? 0],
          ["Passed", data.passed ?? 0],
          ["Pass rate", data.pass_rate == null ? "—" : `${data.pass_rate}%`],
        ]}
      />
      <BreakdownTable title="By status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
    </div>
  );
}

function BreakdownTable({ title, rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <DataTable
        columns={[
          { key: "label", header: "Item", render: (r) => <span className="font-medium capitalize">{String(r.label ?? "—").replace(/_/g, " ")}</span> },
          { key: "count", header: "Value", render: (r) => r.count },
        ]}
        rows={rows}
        rowKey={(r, i) => `${r.label}-${i}`}
        empty={<EmptyState icon="chart" title="No data yet" />}
      />
    </div>
  );
}

/* ------------------------------- Audit log ------------------------------- */

export function AuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of sensitive actions: who did what, to which record, and why. Entries cannot be edited through the app."
      />
      <ResourcePage
        resource={{
          title: "Audit entries",
          subtitle: "Use search to filter by action (e.g. payment, matricule, results).",
          path: "/admin/audit-logs/",
          singular: "Audit entry",
          canWrite: false,
          fields: [],
          columns: [
            { key: "created_at", header: "When", render: (a) => formatDateTime(a.created_at) },
            { key: "actor_email", header: "Actor", render: (a) => a.actor_email || (a.actor ? `user #${a.actor}` : "system") },
            { key: "action", header: "Action", render: (a) => <span className="font-mono text-xs font-semibold">{a.action}</span> },
            { key: "entity", header: "Entity", render: (a) => (a.entity_type ? `${a.entity_type} #${a.entity_id || ""}` : "—") },
            { key: "reason", header: "Reason", render: (a) => a.reason || "—" },
            {
              key: "summary",
              header: "Summary",
              render: (a) => (
                <span className="line-clamp-2 font-mono text-[11px] text-slate-500">
                  {a.summary && Object.keys(a.summary).length ? JSON.stringify(a.summary) : "—"}
                </span>
              ),
            },
          ],
        }}
      />
    </div>
  );
}


