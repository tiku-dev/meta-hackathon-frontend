import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import {
  Alert,
  Card,
  ErrorState,
  LoadingState,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { ProgressBar } from "../components/ui-parts";
import { roleLabel, useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { daysLabel, formatDateTime, formatMoney, formatNumber, num } from "../lib/format";

export function DashboardPage() {
  const auth = useAuth();
  if (auth.has("admin", "super_admin", "admissions", "finance", "registrar", "coordinator")) {
    return <AdminDashboard />;
  }
  if (auth.has("hod")) return <HodDashboard />;
  if (auth.has("lecturer")) return <LecturerDashboard />;
  return <StudentDashboard />;
}

export function Welcome({ title, children }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-brand-950 px-6 py-6 text-white shadow-lg sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 20%, #dcb344 0, transparent 35%), radial-gradient(circle at 10% 90%, #268550 0, transparent 40%)",
        }}
      />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">Dashboard</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        <div className="mt-2 max-w-2xl text-sm text-brand-200">{children}</div>
      </div>
    </div>
  );
}

export function QuickLinks({ links }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((l) => (
        <Link
          key={l.to + l.label}
          to={l.to}
          className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        >
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
            <Icon name={l.icon} size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800">{l.label}</span>
            <span className="block truncate text-xs text-slate-400">{l.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------ Student ------------------------------ */

function StudentDashboard() {
  const auth = useAuth();
  const me = useApi("/student/me");
  const deadlines = useApi("/student/deadlines");
  const announcements = useApi("/announcements/?page_size=3");
  const student = auth.student;

  if (me.loading) return <LoadingState label="Loading your dashboard…" />;
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;

  const d = me.data || {};
  const eligibility = d.eligibility || {};
  const payment = eligibility.payment || {};
  const paidPct =
    num(payment.total_due) > 0
      ? Math.round((num(payment.amount_paid) / num(payment.total_due)) * 100)
      : 0;

  return (
    <div>
      <Welcome title={`Welcome back, ${student?.first_name || auth.displayName}`}>
        {student?.matricule ? (
          <>
            Matricule <span className="font-mono font-semibold text-gold-300">{student.matricule}</span>
            {student.program_name ? <> · {student.program_name}</> : null}
            {student.level_label ? <> · {student.level_label}</> : null}
            {d.semester?.label ? <> · {d.semester.label}</> : null}
          </>
        ) : (
          "Your student workspace."
        )}
      </Welcome>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total fees due"
          value={formatMoney(d.total_due)}
          hint={d.semester?.label || "All invoices"}
          icon="wallet"
          tone="slate"
        />
        <StatCard label="Verified paid" value={formatMoney(d.total_paid)} hint={`${paidPct}% of fees`} icon="check" />
        <StatCard
          label="Credits registered"
          value={`${eligibility.credits_used ?? 0} / ${eligibility.max_credits ?? "—"}`}
          hint={`${eligibility.credits_remaining ?? 0} credits remaining`}
          icon="book"
          tone="blue"
        />
        <StatCard
          label="Registration"
          value={eligibility.eligible ? "Open to you" : "Blocked"}
          hint={eligibility.eligible ? "You meet every requirement" : "See the checklist below"}
          icon={eligibility.eligible ? "check" : "alert"}
          tone={eligibility.eligible ? "brand" : "red"}
        />
      </div>


      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Registration checklist</h2>
            <Link to="/registration" className="text-sm font-semibold text-brand-700 hover:underline">
              Go to registration →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
                <span>
                  Fee threshold — paid {formatMoney(payment.amount_paid, payment.currency)} of{" "}
                  {formatMoney(payment.required || payment.total_due, payment.currency)} required
                </span>
                <span>{paidPct}%</span>
              </div>
              <ProgressBar value={payment.amount_paid} max={payment.required || payment.total_due || 1} />
            </div>
            {(eligibility.reasons || []).length === 0 ? (
              <Alert tone="success">You are eligible to register courses for this semester.</Alert>
            ) : (
              <ul className="space-y-2">
                {eligibility.reasons.map((r) => (
                  <li
                    key={r.code}
                    className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                    <span>
                      {r.message}{" "}
                      {r.code === "PAYMENT_THRESHOLD_NOT_MET" ? (
                        <Link to="/fees" className="font-semibold underline">
                          Pay fees
                        </Link>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Key deadlines</h2>
          <p className="text-xs text-slate-400">Africa/Douala</p>
          <div className="mt-3 space-y-3">
            {(deadlines.data?.deadlines || []).map((dl) => (
              <div key={dl.type} className="rounded-xl bg-slate-50 px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-slate-700">{dl.type} deadline</span>
                  <span
                    className={`text-xs font-bold ${dl.overdue ? "text-red-600" : dl.urgent ? "text-amber-600" : "text-brand-700"}`}
                  >
                    {daysLabel(dl.deadline)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {dl.semester} · {formatDateTime(dl.deadline)}
                </p>
              </div>
            ))}
            {deadlines.data && deadlines.data.deadlines.length === 0 ? (
              <p className="text-sm text-slate-400">No deadlines published for the current semester.</p>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            <Link to="/timetable" className="rounded-lg bg-brand-50 py-2.5 font-semibold text-brand-800 hover:bg-brand-100">
              Timetable
            </Link>
            <Link to="/results" className="rounded-lg bg-gold-100 py-2.5 font-semibold text-gold-700 hover:bg-gold-200">
              My results
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Latest announcements</h2>
          <Link to="/announcements" className="text-sm font-semibold text-brand-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {(announcements.data?.results || []).map((a) => (
            <div key={a.id} className="py-3">
              <p className="text-sm font-semibold text-slate-800">{a.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{a.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {a.author_name || "University"} · {formatDateTime(a.publish_at || a.created_at)}
              </p>
            </div>
          ))}
          {announcements.data && announcements.data.results.length === 0 ? (
            <p className="py-3 text-sm text-slate-400">No announcements yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Admin / staff ------------------------------ */

function AdminDashboard() {
  const auth = useAuth();
  const canOverview = auth.has("admin", "super_admin");
  const overview = useApi("/admin/overview", { enabled: canOverview });
  const feeBalances = useApi("/admin/reports/fee-balances", {
    enabled: auth.has("admin", "super_admin", "finance", "registrar"),
  });
  const d = overview.data || {};
  const fb = feeBalances.data || {};

  return (
    <div>
      <Welcome title={`${auth.displayName} — ${auth.roles.map(roleLabel).join(", ")}`}>
        University operations at a glance
        {d.current_semester?.label ? <> · Current semester: {d.current_semester.label}</> : null}.
        Deadlines shown in Africa/Douala.
      </Welcome>

      {!canOverview ? (
        <Alert tone="info" className="mb-4">
          Your role ({auth.roles.map(roleLabel).join(", ")}) focuses on a specific area — use the
          shortcuts below. University-wide counters are visible to administrators.
        </Alert>
      ) : null}

      {canOverview ? (
        overview.loading ? (
          <LoadingState />
        ) : overview.error ? (
          <ErrorState error={overview.error} onRetry={overview.reload} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active students" value={formatNumber(d.students_active)} icon="users" />
            <StatCard
              label="Pending activation"
              value={formatNumber(d.students_pending_activation)}
              hint="Matricules not yet claimed"
              icon="clock"
              tone="gold"
            />
            <StatCard
              label="Unpaid invoices"
              value={formatNumber(d.unpaid_invoices)}
              hint={`${formatNumber(d.partially_paid_invoices)} partially paid`}
              icon="wallet"
              tone="red"
            />
            <StatCard
              label="Payments needing review"
              value={formatNumber(d.payments_needing_review)}
              hint="Check reconciliation"
              icon="alert"
              tone="red"
            />
            <StatCard label="Course registrations" value={formatNumber(d.registrations)} icon="book" tone="blue" />
            <StatCard
              label="Ungraded result sets"
              value={formatNumber(d.ungraded_offerings)}
              hint="Draft results awaiting marks"
              icon="award"
              tone="gold"
            />
            <StatCard
              label="Fees collected"
              value={formatMoney(fb.total_paid)}
              hint={`of ${formatMoney(fb.total_due)} billed`}
              icon="chart"
            />
            <StatCard
              label="Registration deadline"
              value={d.current_semester?.registration_deadline ? daysLabel(d.current_semester.registration_deadline) : "—"}
              hint={d.current_semester?.label || "No open semester"}
              icon="calendar"
              tone="slate"
            />
          </div>
        )
      ) : null}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-brand-950">Work areas</h2>
      <QuickLinks
        links={[
          { to: "/admin/students", label: "Students & matricules", hint: "Admissions, activation, CSV import", icon: "users" },
          { to: "/admin/hods", label: "Heads of Department", hint: "Assign or remove an HOD per department", icon: "building" },
          { to: "/admin/finance", label: "Finance", hint: "Fee schedules, invoices, reconciliation", icon: "wallet" },
          { to: "/offerings", label: "Course offerings", hint: "Publish offerings & timetables", icon: "layers" },
          { to: "/results-review", label: "Results review", hint: "Publish, lock & correct results", icon: "award" },
          { to: "/admin/academics", label: "Academic structure", hint: "Units, programs, semesters", icon: "building" },
          { to: "/admin/reports", label: "Reports", hint: "Students, fees, payments, results", icon: "chart" },
          { to: "/announcements", label: "Announcements", hint: "Reach every audience", icon: "megaphone" },
          { to: "/admin/audit", label: "Audit log", hint: "Every sensitive action, recorded", icon: "history" },
        ]}
      />
    </div>
  );
}

/* ------------------------------ Lecturer ------------------------------ */

function LecturerDashboard() {
  const auth = useAuth();
  const profile = auth.lecturer;
  const classes = useApi(
    profile?.id ? `/admin/course-offerings/?lecturer=${profile.id}&page_size=100` : null,
    { deps: [profile?.id], enabled: Boolean(profile?.id) },
  );
  const rows = classes.data?.results || [];

  return (
    <div>
      <Welcome title={`Welcome, ${profile?.full_name || auth.displayName}`}>
        {profile?.lecturer_code ? (
          <>
            Lecturer code <span className="font-mono font-semibold text-gold-300">{profile.lecturer_code}</span>
            {profile.department_name ? <> · {profile.department_name}</> : null}
          </>
        ) : (
          "Your teaching workspace."
        )}
      </Welcome>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned classes" value={formatNumber(rows.length)} icon="book" />
        <StatCard
          label="Students enrolled"
          value={formatNumber(rows.reduce((s, r) => s + (r.enrolled_count || 0), 0))}
          icon="users"
          tone="blue"
        />
        <StatCard
          label="Published offerings"
          value={formatNumber(rows.filter((r) => r.status === "published").length)}
          icon="check"
          tone="gold"
        />
      </div>

      <Card className="mt-4" pad={false}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">My classes</h2>
          <p className="text-xs text-slate-500">Open a class to enter CA / exam marks or take attendance.</p>
        </div>
        {classes.loading ? (
          <LoadingState />
        ) : classes.error ? (
          <div className="p-5">
            <ErrorState error={classes.error} onRetry={classes.reload} />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400">
            No classes assigned yet. Ask your HOD or the registrar to assign you to a course offering.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/teaching/classes/${o.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/60"
                >
                  <span className="rounded-lg bg-brand-800 px-2.5 py-1.5 font-mono text-xs font-bold text-white">
                    {o.course_code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{o.course_title}</span>
                    <span className="block text-xs text-slate-400">
                      {o.semester_label} · {o.enrolled_count}/{o.capacity} students · {o.credits} credits
                    </span>
                  </span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ HOD ------------------------------ */

function HodDashboard() {
  const auth = useAuth();
  const overview = useApi("/hod/department/overview");
  const d = overview.data || {};

  return (
    <div>
      <Welcome title={`Department overview — ${auth.lecturer?.department_name || "My department"}`}>
        You manage and review only your own department: offerings, lecturers, students and draft
        results. Approvals are recorded in the audit log.
      </Welcome>

      {overview.loading ? (
        <LoadingState />
      ) : overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Programs" value={formatNumber(d.programs)} icon="layers" />
          <StatCard label="Courses in catalog" value={formatNumber(d.courses)} icon="book" tone="blue" />
          <StatCard label="Course offerings" value={formatNumber(d.offerings)} icon="grid" tone="gold" />
          <StatCard label="Lecturers" value={formatNumber(d.lecturers)} icon="cap" />
          <StatCard label="Department students" value={formatNumber(d.students)} icon="users" tone="blue" />
          <StatCard label="Registrations" value={formatNumber(d.registrations)} icon="check" />
        </div>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-brand-950">Department work</h2>
      <QuickLinks
        links={[
          { to: "/offerings", label: "Department offerings", hint: "Propose & review offerings", icon: "layers" },
          { to: "/hod/marks-upload", label: "Marks upload", hint: "Form or CSV, by matricule", icon: "upload" },
          { to: "/results-review", label: "Approve results", hint: "Review submitted marks", icon: "award" },
          { to: "/admin/students", label: "Department students", hint: "Students in your programs", icon: "users" },
          { to: "/timetable", label: "Timetable", hint: "Sessions for your classes", icon: "calendar" },
        ]}
      />
    </div>
  );
}
