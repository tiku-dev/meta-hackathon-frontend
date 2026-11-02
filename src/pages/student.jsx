import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/icons";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
  useToast,
} from "../components/ui";
import { ProgressBar } from "../components/ui-parts";
import { api, downloadFile, openFile } from "../lib/api";
import { useApi } from "../lib/hooks";
import { formatDate, formatDateTime, formatMoney, num } from "../lib/format";

/* ------------------------- Course registration ------------------------- */

export function RegistrationPage() {
  const toast = useToast();
  const available = useApi("/student/registration/available");
  const mine = useApi("/student/registrations/");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(null);

  const data = available.data || {};
  const offerings = data.offerings || [];
  const myRegs = useMemo(
    () => (mine.data || []).filter((r) => r.status === "registered"),
    [mine.data],
  );
  const registeredIds = useMemo(() => new Set(myRegs.map((r) => r.offering)), [myRegs]);

  const selectedCredits = offerings
    .filter((o) => selected.has(o.id))
    .reduce((s, o) => s + num(o.credits), 0);
  const creditsUsed = num(data.credits_used);
  const maxCredits = num(data.max_credits);
  const projected = creditsUsed + selectedCredits;
  const overLimit = maxCredits > 0 && projected > maxCredits;

  const toggle = (offering) => {
    if (!offering.available || registeredIds.has(offering.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(offering.id)) next.delete(offering.id);
      else next.add(offering.id);
      return next;
    });
  };

  async function register() {
    if (!selected.size) return;
    setBusy(true);
    try {
      await api("/student/registrations/", {
        method: "POST",
        body: { offering_ids: [...selected] },
      });
      toast.success(`Registered for ${selected.size} course(s).`);
      setSelected(new Set());
      available.reload();
      mine.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function drop() {
    if (!dropping) return;
    setBusy(true);
    try {
      await api(`/student/registrations/${dropping.id}/`, { method: "DELETE" });
      toast.success(`Dropped ${dropping.course_code}.`);
      setDropping(null);
      available.reload();
      mine.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (available.loading) return <LoadingState label="Checking your eligibility…" />;
  if (available.error) return <ErrorState error={available.error} onRetry={available.reload} />;

  return (
    <div>
      <PageHeader
        title="Course registration"
        subtitle="Select published courses from any department. All credits — yours and other departments' — count toward your one credit maximum. The backend re-checks the fee threshold, deadline, capacity, timetable conflicts and the credit cap when you submit."
      />

      {(data.reasons || []).length > 0 ? (
        <Alert tone="warning" title="Registration is currently blocked" className="mb-4">
          <ul className="list-inside list-disc space-y-1">
            {data.reasons.map((r) => (
              <li key={r.code}>
                {r.message}
                {["PAYMENT_THRESHOLD_NOT_MET", "REGISTRATION_FEE_REQUIRED"].includes(r.code) ? (
                  <>
                    {" "}
                    <Link to="/fees" className="font-semibold underline">
                      Go to fees & payments
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="success" title="You are eligible to register" className="mb-4">
          Registration deadline: {formatDateTime(data.registration_deadline)} (Africa/Douala).
        </Alert>
      )}

      <Card className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Credits: <strong className="text-slate-900">{creditsUsed}</strong> registered
            {selectedCredits ? (
              <>
                {" "}+ <strong className="text-brand-700">{selectedCredits}</strong> selected
              </>
            ) : null}{" "}
            of <strong className="text-slate-900">{maxCredits || "—"}</strong> maximum
          </div>
          <span className={`text-xs font-bold ${overLimit ? "text-red-600" : "text-slate-400"}`}>
            {Math.max(0, maxCredits - projected)} remaining after selection
          </span>
        </div>
        <ProgressBar
          value={projected}
          max={maxCredits || 1}
          tone={overLimit ? "bg-red-500" : "bg-brand-600"}
        />
        {overLimit ? (
          <p className="mt-2 text-xs font-medium text-red-600">
            This selection exceeds the credit cap — remove a course before submitting.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card pad={false} className="overflow-hidden xl:col-span-3">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Available courses</h2>
            <p className="text-xs text-slate-500">
              Unavailable courses show the exact reason returned by the server.
            </p>
          </div>
          {offerings.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400">
              No published offerings in the current semester yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {offerings.map((o, idx) => {
                const showDeptHeader =
                  idx === 0 || offerings[idx - 1].department_name !== o.department_name;
                const already = registeredIds.has(o.id);
                const checked = selected.has(o.id);
                const disabled = !o.available || already;
                return (
                  <li key={o.id}>
                    {showDeptHeader ? (
                      <div className="flex items-center gap-2 bg-slate-50 px-5 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {o.department_name || "Other courses"}
                        </span>
                        {o.is_cross_department ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            Cross-department
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <label
                      className={`flex items-start gap-3 px-5 py-3.5 ${disabled ? "opacity-75" : "cursor-pointer hover:bg-brand-50/50"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 accent-brand-700"
                        checked={checked || already}
                        disabled={disabled}
                        onChange={() => toggle(o)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-brand-900">{o.course_code}</span>
                          <span className="text-sm font-medium text-slate-700">{o.course_title}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {o.credits} credits · {o.enrolled_count}/{o.capacity} enrolled
                          {o.department_name ? ` · ${o.department_name}` : ""}
                          {o.is_cross_department ? " · Cross-department" : ""}
                          {o.lecturer_name ? ` · ${o.lecturer_name}` : ""}
                          {o.semester_label ? ` · ${o.semester_label}` : ""}
                        </span>
                        {already ? (
                          <span className="mt-1 block text-xs font-semibold text-brand-700">
                            Already in your registrations
                          </span>
                        ) : !o.available && o.unavailable_reason ? (
                          <span className="mt-1 block text-xs font-medium text-amber-700">
                            {o.unavailable_reason.message}
                          </span>
                        ) : null}
                      </span>
                      <StatusBadge status={o.status} />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
            <span className="text-sm text-slate-500">
              {selected.size} course(s) selected · {selectedCredits} credits
            </span>
            <Button
              onClick={register}
              loading={busy}
              disabled={!selected.size || overLimit || !data.eligible}
              icon="check"
            >
              Register selected courses
            </Button>
          </div>
        </Card>

        <Card pad={false} className="h-fit overflow-hidden xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">My registrations</h2>
            <p className="text-xs text-slate-500">{myRegs.length} active course(s) this semester.</p>
          </div>
          {mine.loading ? (
            <LoadingState />
          ) : myRegs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400">
              Nothing registered yet — select courses on the left.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myRegs.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {r.course_code} — {r.course_title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {r.credits} credits · {formatDateTime(r.registered_at)}
                      {r.department_name ? ` · ${r.department_name}` : ""}
                    </span>
                  </span>
                  <Button size="sm" variant="dangerGhost" onClick={() => setDropping(r)}>
                    Drop
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(dropping)}
        onClose={() => setDropping(null)}
        onConfirm={drop}
        loading={busy}
        danger
        title="Drop this course?"
        message={`You will be removed from ${dropping?.course_code || "this course"} and its credits will be freed. You can register again while registration is open.`}
        confirmLabel="Drop course"
      />
    </div>
  );
}

/* ----------------------------- Fees & pay ----------------------------- */

export function FeesPage() {
  const toast = useToast();
  const fees = useApi("/student/fees");
  const receipts = useApi("/student/receipts/?page_size=50");
  const [paying, setPaying] = useState(null);
  const [checking, setChecking] = useState("");
  const [lastAttempt, setLastAttempt] = useState(null);

  const data = fees.data || {};
  const invoices = data.invoices || [];
  const regFee = data.registration_fee || null;
  const regFeeOwed = Boolean(regFee?.required);
  const regFeeInvoice = regFee?.invoice || null;
  const eligibility = data.eligibility || {};
  const payment = eligibility.payment || {};
  const paymentOptions = data.payment_options || {};
  const providerOptions = paymentOptions.providers || {};
  // Backends that predate payment_options (e.g. a dev server that has not
  // been restarted since deploy) send nothing: fall back to offering the
  // real hosted providers, as this page originally did, rather than
  // rendering no way to pay at all. The local simulator stays opt-in
  // because it can fake-credit an invoice.
  const mockEnabled = Boolean(providerOptions.mock?.enabled);
  const notchPayEnabled = providerOptions.notchpay?.enabled ?? true;
  const stripeEnabled = providerOptions.stripe?.enabled ?? true;
  const anyPaymentMethod = mockEnabled || notchPayEnabled || stripeEnabled;

  async function startPayment(invoice, { provider, simulate = false } = {}) {
    const selectedProvider = provider || (simulate ? "mock" : undefined);
    if (simulate && (!mockEnabled || (selectedProvider && selectedProvider !== "mock"))) {
      toast.error("The local payment simulator is not enabled on this server.");
      return null;
    }
    setPaying(`${invoice.id}:${simulate ? "mock" : selectedProvider || "default"}`);
    try {
      const attempt = await api(`/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: {
          amount: String(invoice.balance),
          ...(selectedProvider ? { provider: selectedProvider } : {}),
          callback_url: `${window.location.origin}/payments/return`,
        },
      });
      setLastAttempt(attempt);
      if (simulate) {
        const done = await api(`/payments/${attempt.reference}/mock-simulate`, {
          method: "POST",
          body: { outcome: "succeeded" },
        });
        setLastAttempt(done);
        if (done.status === "succeeded") {
          toast.success("Simulated payment verified — your invoice has been credited.");
        } else {
          toast.info(`Payment status: ${done.status}. Use “Check status” to refresh.`);
        }
        fees.reload();
        receipts.reload();
      } else if (attempt.checkout_url) {
        toast.info(`Opening ${attempt.provider === "stripe" ? "Stripe" : "the provider"} checkout…`);
        window.open(attempt.checkout_url, "_blank", "noopener");
      } else {
        toast.info(
          `Payment ${attempt.reference} created (${attempt.provider}). Use “Check status” after paying.`,
        );
      }
      return attempt;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setPaying(null);
    }
  }

  async function checkStatus(reference) {
    setChecking(reference);
    try {
      const attempt = await api(`/payments/${encodeURIComponent(reference)}/status`);
      setLastAttempt(attempt);
      toast.info(`Payment ${reference}: ${attempt.status}`);
      fees.reload();
      receipts.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChecking("");
    }
  }

  if (fees.loading) return <LoadingState label="Loading your fees…" />;
  if (fees.error) return <ErrorState error={fees.error} onRetry={fees.reload} />;

  return (
    <div>
      <PageHeader
        title="Fees & payments"
        subtitle="Amounts come from the fee schedule configured by finance — never hard-coded. A payment only counts after the provider verifies it server-side."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Required for registration" value={formatMoney(payment.required, payment.currency)} icon="shield" tone="gold" />
        <StatCard label="Verified paid" value={formatMoney(payment.amount_paid, payment.currency)} icon="check" />
        <StatCard
          label="Outstanding balance"
          value={formatMoney(payment.balance, payment.currency)}
          hint={eligibility.eligible ? "Threshold met — registration unlocked" : "Pay the required amount to unlock registration"}
          icon="wallet"
          tone={num(payment.balance) > 0 ? "red" : "brand"}
        />
      </div>

      {regFeeOwed ? (
        <Alert tone="warning" title="One-time registration fee — pay this first" className="mb-4">
          As a new student you must pay the registration fee of{" "}
          <strong>{formatMoney(regFee.amount, regFee.currency)}</strong> before paying school
          fees. You pay it <strong>once only</strong> — once it is verified, fee payments unlock
          and you will never be charged it again.
        </Alert>
      ) : regFee?.paid ? (
        <Alert tone="success" className="mb-4">
          One-time registration fee: {regFee.status === "waived" ? "waived by finance" : "paid"} —
          you will never be charged it again.
        </Alert>
      ) : null}

      {data.current_invoice ? (
        <Alert tone={eligibility.eligible ? "success" : "warning"} className="mb-4">
          {eligibility.eligible
            ? "Your verified payments meet the registration threshold."
            : `Fee deadline ${formatDateTime(data.fee_deadline)} · Registration deadline ${formatDateTime(data.registration_deadline)} (Africa/Douala). Registration unlocks once the required amount is verified.`}
        </Alert>
      ) : (
        <Alert tone="info" className="mb-4">
          No invoice for the current semester yet. Finance generates invoices from the active fee
          schedule — check back soon or contact the finance office.
        </Alert>
      )}

      <div className="space-y-4">
        {invoices.map((inv) => {
          const isRegFeeInvoice = regFeeInvoice && inv.id === regFeeInvoice.id;
          const lockedByRegFee = regFeeOwed && !isRegFeeInvoice;
          return (
          <Card key={inv.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-semibold text-slate-900">
                    {isRegFeeInvoice
                      ? `One-time registration fee — Invoice #${inv.id}`
                      : `Invoice #${inv.id}`}
                  </h3>
                  <StatusBadge status={inv.status} />
                  {isRegFeeInvoice ? (
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-700">
                      Pay first · once only
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {isRegFeeInvoice
                    ? "Pay this once before school fees — you will never be charged it again."
                    : `Due ${formatDate(inv.due_date)} · Required for registration: ${formatMoney(inv.required_for_registration, inv.currency)}`}
                </p>
                {inv.alt_amount ? (
                  <p className="text-xs text-slate-400">
                    Also payable as {formatMoney(inv.alt_amount, inv.alt_currency)} at the approved
                    rate {inv.fx_rate}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Balance</p>
                <p className="text-2xl font-bold text-slate-900">{formatMoney(inv.balance, inv.currency)}</p>
                <p className="text-xs text-slate-500">
                  {formatMoney(inv.amount_paid, inv.currency)} paid of {formatMoney(inv.total_due, inv.currency)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={inv.amount_paid} max={inv.total_due || 1} />
            </div>
            {lockedByRegFee ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700">
                <Icon name="alert" size={16} /> Locked — pay your one-time registration fee
                above first. It is charged once only.
              </p>
            ) : num(inv.balance) > 0 && inv.status !== "waived" && inv.status !== "cancelled" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {stripeEnabled ? (
                  <Button
                    variant="gold"
                    icon="card"
                    loading={paying === `${inv.id}:stripe`}
                    onClick={() => startPayment(inv, { provider: "stripe" })}
                  >
                    Pay {formatMoney(inv.balance, inv.currency)} with Stripe
                    {providerOptions.stripe?.sandbox ? " (test mode)" : ""}
                  </Button>
                ) : null}
                {notchPayEnabled ? (
                  <Button
                    variant="secondary"
                    icon="external"
                    loading={paying === `${inv.id}:notchpay`}
                    onClick={() => startPayment(inv, { provider: "notchpay" })}
                  >
                    Pay with Notch Pay
                  </Button>
                ) : null}
                {mockEnabled ? (
                  <Button
                    variant="ghost"
                    icon="wallet"
                    loading={paying === `${inv.id}:mock`}
                    onClick={() => startPayment(inv, { provider: "mock", simulate: true })}
                  >
                    Simulate payment locally
                  </Button>
                ) : null}
                {!anyPaymentMethod ? (
                  <span className="text-sm font-medium text-amber-700">
                    No online payment method is enabled on the server right now — please contact the finance office.
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  icon="refresh"
                  loading={Boolean(checking)}
                  disabled={!lastAttempt}
                  onClick={() => lastAttempt && checkStatus(lastAttempt.reference)}
                >
                  {lastAttempt ? `Check status (${lastAttempt.status})` : "Check status"}
                </Button>
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-700">
                <Icon name="check" size={16} /> Nothing outstanding on this invoice.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Stripe and Notch Pay open the provider’s hosted checkout in test/sandbox mode when
              test keys are configured. The local simulator is only shown when explicitly enabled
              on the server. Credit is applied only after the server verifies the payment
              reference, amount and currency.
            </p>
          </Card>
          );
        })}
        {invoices.length === 0 ? (
          <EmptyState icon="wallet" title="No invoices yet" message="Invoices appear here once finance issues them for a semester." />
        ) : null}
      </div>

      <ReceiptHistory receipts={receipts} />
    </div>
  );
}

/** Recent verified receipts for the student. */
function ReceiptHistory({ receipts }) {
  const rows = receipts.data?.results || receipts.data || [];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <Card pad={false} className="mt-4 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Verified payments & receipts</h2>
        <p className="text-xs text-slate-500">Receipts are issued automatically once a payment is verified.</p>
      </div>
      <DataTable
        columns={[
          { key: "receipt_number", header: "Receipt", render: (r) => <span className="font-mono text-xs font-semibold">{r.receipt_number}</span> },
          { key: "amount", header: "Amount", render: (r) => formatMoney(r.amount, r.currency) },
          { key: "issued_at", header: "Issued", render: (r) => formatDateTime(r.issued_at) },
          {
            key: "__dl",
            header: "",
            className: "text-right",
            render: (r) => (
              <Button size="sm" variant="secondary" icon="download" onClick={() => downloadFile(`/student/receipts/${r.id}/download/`, `receipt-${r.receipt_number}.pdf`)}>
                PDF
              </Button>
            ),
          },
        ]}
        rows={rows}
      />
    </Card>
  );
}

/* ------------------------------ Receipts ------------------------------ */

export function ReceiptsPage() {
  const list = useApi("/student/receipts/?page_size=100");
  const rows = list.data?.results || [];
  return (
    <div>
      <PageHeader
        title="Payment receipts"
        subtitle="One receipt is issued per verified payment. Download the PDF for your records."
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No receipts yet"
          message="Receipts appear here automatically after a payment is verified."
          action={
            <Link to="/fees">
              <Button icon="wallet">Go to fees & payments</Button>
            </Link>
          }
        />
      ) : (
        <Card pad={false} className="overflow-hidden">
          <DataTable
            columns={[
              { key: "receipt_number", header: "Receipt №", render: (r) => <span className="font-mono text-xs font-bold">{r.receipt_number}</span> },
              { key: "invoice_id", header: "Invoice", render: (r) => `#${r.invoice_id}` },
              { key: "amount", header: "Amount", render: (r) => <span className="font-semibold">{formatMoney(r.amount, r.currency)}</span> },
              { key: "issued_at", header: "Issued", render: (r) => formatDateTime(r.issued_at) },
              {
                key: "__dl",
                header: "",
                className: "text-right",
                render: (r) => (
                  <Button size="sm" variant="secondary" icon="download" onClick={() => downloadFile(`/student/receipts/${r.id}/download/`, `receipt-${r.receipt_number}.pdf`)}>
                    Download PDF
                  </Button>
                ),
              },
            ]}
            rows={rows}
          />
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Results ------------------------------ */

export function ResultsPage() {
  const results = useApi("/student/results");
  const rows = results.data?.results || [];
  const policy = results.data?.policy;
  const gpa = results.data?.gpa;

  return (
    <div>
      <PageHeader
        title="My results"
        subtitle="Only published results are shown. Grades and GPA come from the grading policy configured by the university."
        actions={
          <Link to="/transcript">
            <Button variant="secondary" icon="file">View transcript</Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="GPA" value={gpa ?? "—"} hint={policy ? `${policy.name} · scale ${policy.gpa_scale}` : "No active policy"} icon="award" tone="gold" />
        <StatCard label="Courses published" value={rows.length} icon="book" />
        <StatCard
          label="Passed"
          value={`${rows.filter((r) => r.is_pass).length} / ${rows.length}`}
          hint="Published courses only"
          icon="check"
        />
      </div>

      {results.loading ? (
        <LoadingState />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="award"
          title="No published results yet"
          message="When lecturers enter marks and the registrar publishes them, your grades will appear here."
        />
      ) : (
        <Card pad={false} className="overflow-hidden">
          <DataTable
            columns={[
              {
                key: "course",
                header: "Course",
                render: (r) => (
                  <span>
                    <span className="font-mono font-bold text-brand-900">{r.course_code}</span>{" "}
                    <span className="text-slate-600">{r.course_title}</span>
                  </span>
                ),
              },
              { key: "credits", header: "Credits" },
              { key: "ca_mark", header: `CA /${policy?.ca_max ?? 30}`, render: (r) => r.ca_mark ?? "—" },
              { key: "final_mark", header: `Exam /${policy?.exam_max ?? 70}`, render: (r) => r.final_mark ?? "—" },
              { key: "total", header: "Total /100", render: (r) => <span className="font-bold">{r.total ?? "—"}</span> },
              {
                key: "grade",
                header: "Grade",
                render: (r) => (
                  <span className="flex items-center gap-2">
                    <GradeBadgeInline letter={r.grade_letter} />
                    <span className={`text-xs font-semibold ${r.is_pass ? "text-brand-700" : "text-red-600"}`}>
                      {r.is_pass ? "Pass" : "Fail"}
                    </span>
                  </span>
                ),
              },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ]}
            rows={rows}
          />
        </Card>
      )}

      {policy?.bands?.length ? (
        <Card className="mt-4">
          <h2 className="font-semibold text-slate-900">Grading bands — {policy.name}</h2>
          <p className="text-xs text-slate-500">
            CA max {policy.ca_max} · Exam max {policy.exam_max} · Pass mark {policy.pass_mark}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...policy.bands]
              .sort((a, b) => num(b.min_score) - num(a.min_score))
              .map((b) => (
                <span key={b.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  <strong className="text-slate-900">{b.letter}</strong> · {b.min_score}–{b.max_score} · {b.points} pts
                  {b.label ? ` · ${b.label}` : ""}
                </span>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function GradeBadgeInline({ letter }) {
  if (!letter) return <span className="text-slate-400">—</span>;
  const good = ["A", "B"].some((p) => String(letter).startsWith(p));
  const mid = String(letter).startsWith("C") || String(letter).startsWith("D");
  const tone = good ? "bg-brand-700 text-white" : mid ? "bg-gold-500 text-brand-950" : "bg-red-600 text-white";
  return (
    <span className={`inline-flex min-w-9 items-center justify-center rounded-md px-2 py-1 text-sm font-bold ${tone}`}>
      {letter}
    </span>
  );
}

/* ----------------------------- Transcript ----------------------------- */

export function TranscriptPage() {
  const requests = useApi("/admin/transcripts/?page_size=50");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const rows = requests.data?.results || [];

  async function requestTranscript() {
    setBusy(true);
    try {
      await api("/admin/transcripts/", { method: "POST", body: {} });
      toast.success("Transcript requested. The registrar will review it.");
      requests.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Transcript"
        subtitle="Download an unofficial draft now, or request an official transcript from the registrar. Official documents carry an issue number."
        actions={
          <>
            <Button variant="secondary" icon="eye" onClick={() => openFile("/student/transcript")}>
              Preview draft PDF
            </Button>
            <Button icon="download" onClick={() => downloadFile("/student/transcript", "transcript-draft.pdf")}>
              Download draft (unofficial)
            </Button>
          </>
        }
      />
      <Alert tone="info" className="mb-4">
        The self-service PDF is labelled <strong>DRAFT / UNOFFICIAL</strong>. Only a registrar-issued
        transcript (with an issue number below) is official.
      </Alert>

      <Card pad={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">My transcript requests</h2>
            <p className="text-xs text-slate-500">Requested, approved and issued transcripts.</p>
          </div>
          <Button size="sm" icon="send" loading={busy} onClick={requestTranscript}>
            Request official transcript
          </Button>
        </div>
        {requests.loading ? (
          <LoadingState />
        ) : requests.error ? (
          <div className="p-5">
            <ErrorState error={requests.error} onRetry={requests.reload} />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400">No requests yet.</p>
        ) : (
          <DataTable
            columns={[
              { key: "id", header: "Request", render: (r) => `#${r.id}` },
              { key: "is_official", header: "Type", render: (r) => (r.is_official ? "Official" : "Unofficial") },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { key: "issue_number", header: "Issue №", render: (r) => r.issue_number || "—" },
              { key: "created_at", header: "Requested", render: (r) => formatDateTime(r.created_at) },
              {
                key: "__dl",
                header: "",
                className: "text-right",
                render: (r) => (
                  <Button size="sm" variant="secondary" icon="download" onClick={() => downloadFile(`/admin/transcripts/${r.id}/download/`, `transcript-${r.id}.pdf`)}>
                    PDF
                  </Button>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </Card>
    </div>
  );
}

/* --------------------------- Payment return --------------------------- */

export function PaymentReturnPage() {
  const [params] = useSearchParams();
  // Providers disagree about which id lands in which parameter: Notch Pay
  // appends reference=<its trx id> plus trxref/notchpay_trxref=<our PAY-...
  // id>, while other returns may only carry ref=. Prefer our internal
  // reference; the backend also resolves provider references as a fallback.
  const reference =
    params.get("trxref") ||
    params.get("notchpay_trxref") ||
    params.get("merchant_reference") ||
    params.get("reference") ||
    params.get("ref") ||
    "";
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(Boolean(reference));

  useEffect(() => {
    if (!reference) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No payment reference was provided in the return URL.");
      return undefined;
    }
    let alive = true;
    let tries = 0;
    const tick = async () => {
      try {
        const data = await api(`/payments/${encodeURIComponent(reference)}/status`);
        if (!alive) return;
        setAttempt(data);
        tries += 1;
        if (["succeeded", "failed", "cancelled", "needs_review"].includes(data.status) || tries >= 10) {
          setPolling(false);
          return;
        }
        timer = setTimeout(tick, 2500);
      } catch (err) {
        if (alive) {
          setError(err.message);
          setPolling(false);
        }
      }
    };
    let timer = setTimeout(tick, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reference]);

  const succeeded = attempt?.status === "succeeded";

  return (
    <div>
      <PageHeader
        title="Payment confirmation"
        subtitle="We never trust the browser redirect — the server verifies the payment with the provider before crediting your invoice."
      />
      <Card className="mx-auto max-w-xl text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            error
              ? "bg-red-50 text-red-600"
              : succeeded
                ? "bg-brand-50 text-brand-700"
                : "bg-gold-100 text-gold-700"
          }`}
        >
          <Icon name={error ? "alert" : succeeded ? "check" : "clock"} size={30} />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-brand-950">
          {error
            ? "We could not verify this payment"
            : succeeded
              ? "Payment verified"
              : polling
                ? "Verifying with the provider…"
                : `Payment status: ${attempt?.status || "unknown"}`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          {error ||
            (succeeded
              ? "Your invoice has been credited and a receipt issued. Course registration is now unlocked if the threshold is met."
              : "This page checks the provider status automatically. You can also refresh from Fees & payments.")}
        </p>
        {attempt ? (
          <dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Reference</dt>
              <dd className="break-all font-mono text-xs font-semibold">{attempt.reference}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Amount</dt>
              <dd className="text-sm font-semibold">{formatMoney(attempt.amount, attempt.currency)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Provider</dt>
              <dd className="text-sm font-semibold capitalize">{attempt.provider}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Status</dt>
              <dd>
                <StatusBadge status={attempt.status} />
              </dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/fees">
            <Button icon="wallet">Back to fees</Button>
          </Link>
          <Link to="/registration">
            <Button variant="secondary" icon="edit">Course registration</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

// Payment status is always re-verified server-side (see /payments/:ref/status).









