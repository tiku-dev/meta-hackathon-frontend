import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  GradeBadge,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
  useToast,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";

/**
 * Results workflow: lecturer submits → HOD approves → registrar/admin
 * publishes → optionally locks. Corrections after publication require a
 * reason and are audit-logged by the backend.
 */
export function ResultsReviewPage() {
  const auth = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const offeringsReq = useApi("/admin/course-offerings/?page_size=200");
  const offeringRows = useMemo(() => offeringsReq.data?.results || [], [offeringsReq.data]);

  const selectedId = params.get("offering") || "";
  const results = useApi(selectedId ? `/admin/offerings/${selectedId}/results` : null, {
    deps: [selectedId],
    enabled: Boolean(selectedId),
  });
  const rows = useMemo(() => results.data?.results || [], [results.data]);
  const policy = results.data?.policy;
  const offeringInfo = results.data?.offering;

  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // "approve" | "publish" | "lock"
  const [correcting, setCorrecting] = useState(null);

  const canApprove = auth.has("hod", "admin", "super_admin");
  const canPublish = auth.has("admin", "super_admin", "registrar");
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const summary = useMemo(() => {
    const graded = rows.filter((r) => r.total != null);
    const passed = graded.filter((r) => r.is_pass).length;
    return {
      total: rows.length,
      graded: graded.length,
      passed,
      passRate: graded.length ? Math.round((passed / graded.length) * 100) : null,
    };
  }, [rows]);

  async function run(action) {
    setBusy(action);
    try {
      const path =
        action === "approve"
          ? `/hod/offerings/${selectedId}/approve-results`
          : action === "publish"
            ? `/admin/offerings/${selectedId}/publish-results`
            : `/admin/offerings/${selectedId}/lock-results`;
      const res = await api(path, { method: "POST", body: {} });
      toast.success(
        action === "approve"
          ? `Approved ${res?.approved ?? ""} result(s).`
          : action === "publish"
            ? `Published ${res?.published ?? ""} result(s).`
            : `Locked ${res?.locked ?? ""} result(s).`,
      );
      setConfirm(null);
      results.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Results review & publication"
        subtitle="Workflow: lecturer drafts → submitted → HOD approved → published → locked. Students only ever see published or locked results."
      />

      <Card className="mb-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="Course offering">
            <Select
              value={selectedId}
              onChange={(e) => setParams(e.target.value ? { offering: e.target.value } : {})}
              placeholder="Select an offering to review…"
              options={offeringRows.map((o) => ({
                value: o.id,
                label: `${o.course_code} — ${o.course_title} · ${o.semester_label || ""} · ${o.enrolled_count}/${o.capacity}`,
              }))}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === "approve"}
              disabled={!selectedId || Boolean(busy)}
              onClick={() => setConfirm("approve")}
            >
              HOD approve
            </Button>
            <Button
              loading={busy === "publish"}
              disabled={!selectedId || Boolean(busy)}
              onClick={() => setConfirm("publish")}
              icon="send"
            >
              Publish results
            </Button>
            <Button
              variant="secondary"
              loading={busy === "lock"}
              disabled={!selectedId || Boolean(busy)}
              onClick={() => setConfirm("lock")}
              icon="lock"
            >
              Lock
            </Button>
          </div>
        </div>
        {!canApprove || !canPublish ? (
          <p className="mt-3 text-xs text-slate-400">
            Your roles: {auth.roles.join(", ") || "—"}. The server enforces who may approve (HOD of
            the department) and publish (registrar/admin) regardless of these buttons.
          </p>
        ) : null}
      </Card>

      {!selectedId ? (
        <EmptyState
          icon="award"
          title="Choose an offering"
          message="Pick a course offering above to inspect its result set and move it through the approval workflow."
        />
      ) : results.loading ? (
        <LoadingState label="Loading result set…" />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.reload} />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-4">
            <MiniStat label="Students" value={summary.total} />
            <MiniStat label="Graded" value={summary.graded} />
            <MiniStat label="Passed" value={summary.passed} />
            <MiniStat label="Pass rate" value={summary.passRate == null ? "—" : `${summary.passRate}%`} />
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Statuses in this set: {statuses.length ? statuses.join(", ") : "none"}
            {policy ? ` · Policy: ${policy.name} (CA /${policy.ca_max}, exam /${policy.exam_max})` : ""}
            {offeringInfo?.lecturer_name ? ` · Lecturer: ${offeringInfo.lecturer_name}` : ""}
          </p>
          <Card pad={false} className="overflow-hidden">
            <DataTable
              columns={[
                { key: "student_matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.student_matricule}</span> },
                { key: "student_name", header: "Student" },
                { key: "ca_mark", header: "CA", render: (r) => r.ca_mark ?? "—" },
                { key: "final_mark", header: "Exam", render: (r) => r.final_mark ?? "—" },
                { key: "total", header: "Total", render: (r) => <span className="font-bold">{r.total ?? "—"}</span> },
                { key: "grade", header: "Grade", render: (r) => <GradeBadge letter={r.grade_letter} points={r.grade_points} /> },
                {
                  key: "is_pass",
                  header: "Outcome",
                  render: (r) =>
                    r.total == null ? "—" : r.is_pass ? (
                      <span className="font-semibold text-brand-700">Pass</span>
                    ) : (
                      <span className="font-semibold text-red-600">Fail</span>
                    ),
                },
                { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: "__fix",
                  header: "",
                  className: "text-right",
                  render: (r) =>
                    ["published", "locked"].includes(r.status) && auth.has("admin", "super_admin", "registrar") ? (
                      <Button size="sm" variant="ghost" onClick={() => setCorrecting(r)}>
                        Correct
                      </Button>
                    ) : null,
                },
              ]}
              rows={rows}
              empty={<EmptyState icon="award" title="No marks yet" message="The lecturer has not saved any marks for this offering." />}
            />
          </Card>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(confirm)}
        loading={Boolean(busy)}
        title={
          confirm === "approve"
            ? "Approve submitted results?"
            : confirm === "publish"
              ? "Publish results to students?"
              : "Lock this result set?"
        }
        message={
          confirm === "approve"
            ? "Only 'submitted' rows move to HOD-approved. Drafts stay with the lecturer."
            : confirm === "publish"
              ? "HOD-approved results become visible to students and count toward GPA. This is audited."
              : "Published results become locked and can then only change through an audited correction."
        }
        confirmLabel={confirm === "approve" ? "Approve" : confirm === "publish" ? "Publish" : "Lock"}
      />

      {correcting ? (
        <CorrectionModal
          result={correcting}
          policy={policy}
          onClose={() => setCorrecting(null)}
          onSaved={() => {
            setCorrecting(null);
            results.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function CorrectionModal({ result, policy, onClose, onSaved }) {
  const toast = useToast();
  const [ca, setCa] = useState(result.ca_mark ?? "");
  const [finalMark, setFinalMark] = useState(result.final_mark ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("A reason is required for an audited correction.");
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/results/${result.id}/correct`, {
        method: "POST",
        body: {
          ca_mark: ca === "" ? null : Number(ca),
          final_mark: finalMark === "" ? null : Number(finalMark),
          reason: reason.trim(),
        },
      });
      toast.success("Correction recorded with an audit trail.");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Close" className="absolute inset-0 bg-brand-950/50" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-lg animate-pop rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <h2 className="font-display text-lg font-semibold text-brand-950">Correct published result</h2>
        <p className="mt-1 text-sm text-slate-500">
          {result.student_matricule} — {result.student_name}. Current total {result.total ?? "—"} (grade {result.grade_letter || "—"}).
          The old and new values are stored with your reason.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`CA mark (max ${policy?.ca_max ?? 30})`}>
            <TextInput type="number" min="0" step="0.01" value={ca} onChange={(e) => setCa(e.target.value)} />
          </Field>
          <Field label={`Exam mark (max ${policy?.exam_max ?? 70})`}>
            <TextInput type="number" min="0" step="0.01" value={finalMark} onChange={(e) => setFinalMark(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason for correction" required className="mt-4">
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Mark transcription error verified against the script" required />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="danger" loading={saving}>Record correction</Button>
        </div>
      </form>
    </div>
  );
}


