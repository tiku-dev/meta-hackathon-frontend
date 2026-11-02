import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  FormGrid,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  StatusBadge,
  TextArea,
  TextInput,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { Welcome } from "./dashboards";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApi, usePagedList } from "../lib/hooks";
import { formatDateTime, formatNumber, humanize } from "../lib/format";

const PRIORITY_TONE = {
  urgent: "bg-red-600 text-white",
  high: "bg-amber-500 text-white",
  normal: "bg-slate-500 text-white",
};

function PriorityBadge({ priority }) {
  const key = String(priority || "normal").toLowerCase();
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${PRIORITY_TONE[key] || PRIORITY_TONE.normal}`}
    >
      {humanize(key)}
    </span>
  );
}

/* ----------------------------- Announcements ----------------------------- */

const ROLE_OPTIONS = ["student", "lecturer", "hod", "registrar", "finance", "admin"].map((r) => ({
  value: r,
  label: r,
}));

const announcementFields = [
  { name: "title", label: "Title", required: true, span: 2 },
  { name: "body", label: "Body", type: "textarea", required: true, span: 2, rows: 5 },
  {
    name: "audience_type",
    label: "Audience",
    type: "select",
    options: [
      { value: "all", label: "All university" },
      { value: "unit", label: "Academic unit" },
      { value: "program", label: "Program" },
      { value: "level", label: "Level" },
      { value: "role", label: "Role" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ],
  },
  { name: "audience_unit", label: "Audience unit", type: "lookup", lookup: "units", showWhen: (f) => f.audience_type === "unit" },
  { name: "audience_program", label: "Audience program", type: "lookup", lookup: "programs", showWhen: (f) => f.audience_type === "program" },
  { name: "audience_level", label: "Audience level", type: "lookup", lookup: "levels", showWhen: (f) => f.audience_type === "level" },
  { name: "audience_role", label: "Audience role", type: "select", options: ROLE_OPTIONS, showWhen: (f) => f.audience_type === "role" },
  { name: "publish_at", label: "Publish at", type: "datetime" },
  { name: "expires_at", label: "Expires at", type: "datetime" },
];

export function AnnouncementsPage() {
  const auth = useAuth();
  const toast = useToast();
  const canManage = auth.has("admin", "super_admin", "registrar", "coordinator");

  if (!canManage) return <AnnouncementFeed />;

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Target the whole university or a unit, program, level or role. People only see announcements addressed to them."
      />
      <ResourcePage
        resource={{
          title: "Announcements",
          path: "/announcements/",
          singular: "Announcement",
          canWrite: canManage,
          fields: announcementFields,
          filters: [
            { name: "status", label: "All statuses", options: [
              { value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" },
            ]},
            { name: "audience_type", label: "All audiences", options: [
              { value: "all", label: "All" }, { value: "unit", label: "Unit" }, { value: "program", label: "Program" },
              { value: "level", label: "Level" }, { value: "role", label: "Role" },
            ]},
          ],
          columns: [
            {
              key: "title",
              header: "Announcement",
              render: (a) => (
                <span>
                  <span className="font-medium text-slate-800">{a.title}</span>
                  <span className="block text-xs text-slate-400">{a.author_name || "University"}</span>
                </span>
              ),
            },
            { key: "audience_type", header: "Audience" },
            { key: "publish_at", header: "Published", render: (a) => formatDateTime(a.publish_at || a.created_at) },
            { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
          ],
          actions: (row, ctx) =>
            row.status !== "published" ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await api(`/announcements/${row.id}/publish/`, { method: "POST", body: {} });
                    toast.success("Announcement published.");
                    ctx.reload();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              >
                Publish
              </Button>
            ) : null,
        }}
      />
    </div>
  );
}


function AnnouncementFeed() {
  const list = usePagedList("/announcements/", { pageSize: 10 });
  return (
    <div>
      <PageHeader title="Announcements" subtitle="Notices addressed to you by the university." />
      {list.loading && !list.rows.length ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState icon="megaphone" title="No announcements" message="University notices will appear here." />
      ) : (
        <div className="space-y-3">
          {list.rows.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-brand-950">{a.title}</h2>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {a.author_name || "University"} · {formatDateTime(a.publish_at || a.created_at)}
                {a.audience_type !== "all" ? ` · For ${a.audience_type}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.body}</p>
            </Card>
          ))}
          {list.pageCount > 1 ? (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={list.page >= list.pageCount} onClick={() => list.setPage(list.page + 1)}>Next</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Events -------------------------------- */

const eventFields = [
  { name: "title", label: "Title", required: true, span: 2 },
  { name: "details", label: "Details", type: "textarea", span: 2 },
  { name: "start_at", label: "Starts at", type: "datetime", required: true },
  { name: "end_at", label: "Ends at", type: "datetime" },
  { name: "location", label: "Location" },
  { name: "meeting_link", label: "Meeting link", type: "url" },
  {
    name: "audience_type",
    label: "Audience",
    type: "select",
    options: [
      { value: "all", label: "All university" },
      { value: "unit", label: "Academic unit" },
      { value: "program", label: "Program" },
      { value: "level", label: "Level" },
      { value: "role", label: "Role" },
    ],
  },
  { name: "audience_program", label: "Audience program", type: "lookup", lookup: "programs", showWhen: (f) => f.audience_type === "program" },
  { name: "audience_level", label: "Audience level", type: "lookup", lookup: "levels", showWhen: (f) => f.audience_type === "level" },
  { name: "rsvp_enabled", label: "RSVP", type: "checkbox", checkboxLabel: "Allow RSVPs" },
  { name: "is_published", label: "Published", type: "checkbox", checkboxLabel: "Published" },
];

export function EventsPage() {
  const auth = useAuth();
  const canManage = auth.has("admin", "super_admin", "registrar", "coordinator");
  if (canManage) return <EventsAdmin />;
  return <EventsFeed />;
}

function EventsAdmin() {
  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="University events with audience targeting and RSVPs."
      />
      <ResourcePage
        resource={{
          title: "Events",
          path: "/events/",
          singular: "Event",
          canWrite: true,
          fields: eventFields,
          filters: [
            { name: "audience_type", label: "All audiences", options: [
              { value: "all", label: "All" }, { value: "unit", label: "Unit" }, { value: "program", label: "Program" },
              { value: "level", label: "Level" }, { value: "role", label: "Role" },
            ]},
            { name: "is_published", label: "Published?", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
          ],
          columns: [
            {
              key: "title",
              header: "Event",
              render: (e) => (
                <span>
                  <span className="font-medium text-slate-800">{e.title}</span>
                  <span className="block text-xs text-slate-400">{e.location || "Location TBA"}</span>
                </span>
              ),
            },
            { key: "start_at", header: "Starts", render: (e) => formatDateTime(e.start_at) },
            { key: "rsvp_count", header: "Going" },
            { key: "is_published", header: "Published", render: (e) => (e.is_published ? "Yes" : "No") },
          ],
        }}
      />
    </div>
  );
}

function EventsFeed() {
  const toast = useToast();
  const list = usePagedList("/events/", { pageSize: 12 });
  const [busyId, setBusyId] = useState(null);

  async function rsvp(event, status) {
    setBusyId(event.id);
    try {
      await api(`/events/${event.id}/rsvp/`, { method: "POST", body: { status } });
      toast.success(`RSVP saved: ${status}.`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Events" subtitle="University events open to you — RSVP with one click." />
      {list.loading && !list.rows.length ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState icon="calendar" title="No events" message="Events addressed to you will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.rows.map((e) => (
            <Card key={e.id} className="flex flex-col">
              <p className="text-xs font-bold uppercase tracking-wide text-gold-600">
                {formatDateTime(e.start_at)}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-brand-950">{e.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {e.location || "Location TBA"}
                {e.end_at ? ` · ends ${formatDateTime(e.end_at)}` : ""}
              </p>
              {e.details ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{e.details}</p> : null}
              <p className="mt-3 text-xs text-slate-400">{e.rsvp_count} going</p>
              <div className="mt-auto pt-4">
                {e.rsvp_enabled ? (
                  <div className="flex flex-wrap gap-1.5">
                    {["going", "maybe", "declined"].map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busyId === e.id}
                        onClick={() => rsvp(e, st)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ring-1 transition ${
                          e.my_rsvp === st
                            ? st === "going"
                              ? "bg-brand-700 text-white ring-brand-700"
                              : st === "maybe"
                                ? "bg-gold-500 text-brand-950 ring-gold-500"
                                : "bg-slate-600 text-white ring-slate-600"
                            : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">RSVP is disabled for this event.</p>
                )}
                {e.meeting_link ? (
                  <a href={e.meeting_link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
                    Join online →
                  </a>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Notifications ----------------------------- */

const TYPE_ICON = {
  payment: "wallet",
  registration: "edit",
  result: "award",
  deadline: "clock",
  announcement: "megaphone",
  system: "bell",
  emergency: "lifeRing",
  account: "users",
};

export function NotificationsPage() {
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = usePagedList(`/notifications/${unreadOnly ? "?unread=1" : ""}`, {
    pageSize: 20,
    deps: [unreadOnly],
  });
  const unread = useApi("/notifications/unread-count/");
  const [busy, setBusy] = useState(false);

  async function readAll() {
    setBusy(true);
    try {
      const res = await api("/notifications/read-all/", { method: "POST", body: {} });
      toast.success(`${res.marked_read} notification(s) marked as read.`);
      list.reload();
      unread.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markRead(n) {
    if (n.is_read) return;
    try {
      await api(`/notifications/${n.id}/read/`, { method: "POST", body: {} });
      list.reload();
      unread.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${formatNumber(unread.data?.unread || 0)} unread · payments, registrations, results, deadlines and announcements.`}
        actions={
          <>
            <Button variant={unreadOnly ? "primary" : "secondary"} size="sm" onClick={() => setUnreadOnly((v) => !v)}>
              {unreadOnly ? "Showing unread" : "Unread only"}
            </Button>
            <Button size="sm" loading={busy} onClick={readAll} icon="check">
              Mark all read
            </Button>
          </>
        }
      />

      {list.loading && !list.rows.length ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState icon="bell" title="All caught up" message="No notifications match this view." />
      ) : (
        <div className="space-y-2.5">
          {list.rows.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markRead(n)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-sm transition ${
                n.is_read
                  ? "border-slate-200/80 bg-white text-slate-500"
                  : "border-brand-200 bg-brand-50/70 text-slate-800 ring-1 ring-brand-100"
              }`}
            >
              <span className={`rounded-xl p-2 ${n.is_read ? "bg-slate-100 text-slate-400" : "bg-brand-700 text-white"}`}>
                <Icon name={TYPE_ICON[n.notification_type] || "bell"} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{n.title}</span>
                  {!n.is_read ? (
                    <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
                  ) : null}
                </span>
                {n.body ? <span className="mt-0.5 block text-sm opacity-80">{n.body}</span> : null}
                <span className="mt-1 block text-xs opacity-60">
                  {n.notification_type} · {formatDateTime(n.created_at)}
                </span>
              </span>
            </button>
          ))}
          {list.pageCount > 1 ? (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={list.page >= list.pageCount} onClick={() => list.setPage(list.page + 1)}>Next</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


/* ------------------------------- HOD page -------------------------------- */

export function HodPage() {
  const auth = useAuth();
  const overview = useApi("/hod/department/overview");
  const d = overview.data || {};

  return (
    <div>
      <Welcome title={`Department — ${auth.lecturer?.department_name || "My department"}`}>
        You see and manage only your own department: programs, courses, offerings, lecturers,
        students and registrations. Approvals are audited.
      </Welcome>

      {overview.loading ? (
        <LoadingState />
      ) : overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Programs", d.programs],
            ["Courses in catalog", d.courses],
            ["Course offerings", d.offerings],
            ["Lecturers", d.lecturers],
            ["Department students", d.students],
            ["Registrations", d.registrations],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-brand-950">Department work</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/offerings", label: "Department offerings", hint: "Propose & review offerings", icon: "layers" },
          { to: "/hod/marks-upload", label: "Marks upload", hint: "Form or CSV, by matricule", icon: "upload" },
          { to: "/results-review", label: "Approve results", hint: "Submitted marks queue", icon: "award" },
          { to: "/admin/students", label: "Department students", hint: "Students in your programs", icon: "users" },
          { to: "/timetable", label: "Timetable", hint: "Sessions for your classes", icon: "calendar" },
        ].map((l) => (
          <Link
            key={l.to}
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
    </div>
  );
}


/* ------------------------- Emergency contact -----------------------------
 * Student → administration urgent contact.
 *
 * Two halves:
 *  - ContactAdminPage (/contact-admin): directory + send + track/replies.
 *  - AdminEmergencyContactsPage (/admin/emergency-contacts): triage inbox
 *    with priority/status filters, assignment, reply, resolve/close.
 * ------------------------------------------------------------------------- */

const EMERGENCY_CATEGORIES = [
  { value: "medical", label: "Medical emergency" },
  { value: "security", label: "Security / safety" },
  { value: "welfare", label: "Personal welfare / distress" },
  { value: "financial", label: "Financial hardship" },
  { value: "technical", label: "Account / portal access" },
  { value: "other", label: "Other urgent matter" },
];
const EMERGENCY_CATEGORY_LABEL = Object.fromEntries(
  EMERGENCY_CATEGORIES.map((c) => [c.value, c.label]),
);
const EMERGENCY_PRIORITIES = [
  { value: "urgent", label: "Urgent — needs help now" },
  { value: "high", label: "High — today" },
  { value: "normal", label: "Normal — within a few days" },
];
const EMERGENCY_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function ContactRow({ contact, action }) {
  const hasReply = Boolean(contact.admin_reply);
  // Backend clears student_read_at on each new reply — that is the truth.
  const unreadReply = hasReply && !contact.student_read_at;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-brand-950">{contact.subject}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {EMERGENCY_CATEGORY_LABEL[contact.category] || humanize(contact.category)} ·{" "}
            {formatDateTime(contact.created_at)}
            {contact.location ? ` · ${contact.location}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={contact.priority} />
          <StatusBadge status={contact.status} />
          {unreadReply ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              NEW REPLY
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
        {contact.message}
      </p>
      {hasReply ? (
        <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            Reply from administration
            {contact.assigned_to_name ? ` · ${contact.assigned_to_name}` : ""}
            {contact.first_response_at ? ` · ${formatDateTime(contact.first_response_at)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{contact.admin_reply}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-slate-400">
          Sent to administration — an admin will reply here. Urgent cases are also flagged to
          admins immediately.
        </p>
      )}
      {action ? <div className="mt-3">{action({ contact, unreadReply })}</div> : null}
    </Card>
  );
}



export function ContactAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const student = auth.student || {};
  const directoryReq = useApi("/student/emergency-directory/");
  const mine = useApi("/student/emergency-contacts/");
  const [form, setForm] = useState({
    category: "other",
    priority: "normal",
    subject: "",
    message: "",
    contact_phone: "",
    contact_email: "",
    location: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const directory = directoryReq.data || {};
  const directoryContacts = directory.contacts || [];
  const contacts = mine.data?.contacts || [];
  const canSubmit =
    form.subject.trim().length >= 3 && form.message.trim().length >= 10 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await api("/student/emergency-contacts", {
        method: "POST",
        body: {
          category: form.category,
          priority: form.priority,
          subject: form.subject.trim(),
          message: form.message.trim(),
          contact_phone: form.contact_phone.trim(),
          contact_email: form.contact_email.trim(),
          location: form.location.trim(),
        },
      });
      toast.success(
        created.priority === "urgent"
          ? "Emergency message sent — administration has been alerted."
          : "Message sent to administration.",
      );
      setForm((f) => ({ ...f, subject: "", message: "", location: "" }));
      mine.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Contact administration"
        subtitle="Reach the administration fast in an emergency — medical, security, welfare or urgent account problems. Admins are alerted immediately and reply here."
      />

      <Alert tone="danger" title="Immediate danger?" className="mb-4">
        {directory.escalation_note ||
          "For immediate danger, call campus security or local emergency services first, then send an emergency message here."}{" "}
        This page is monitored by administration but is not a replacement for emergency services.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="phone" size={18} className="text-brand-700" /> Emergency directory
          </h2>
          {directoryReq.loading ? (
            <LoadingState label="Loading contacts…" />
          ) : directoryReq.error ? (
            <ErrorState error={directoryReq.error} onRetry={directoryReq.reload} />
          ) : directoryContacts.length === 0 && !directory.emergency_email ? (
            <p className="mt-3 text-sm text-slate-500">
              No phone directory is published yet — use the emergency message form and an admin
              will contact you.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {directoryContacts.map((c) => (
                <li key={c.label} className="rounded-xl bg-slate-50 px-3.5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{c.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{c.name || c.label}</p>
                  {c.phone ? (
                    <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                      <Icon name="phone" size={14} /> {c.phone}
                    </a>
                  ) : null}
                </li>
              ))}
              {directory.emergency_email ? (
                <li className="rounded-xl bg-slate-50 px-3.5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Emergency email</p>
                  <a href={`mailto:${directory.emergency_email}`} className="mt-1 flex items-center gap-1.5 break-all text-sm font-semibold text-brand-700 hover:underline">
                    <Icon name="mail" size={14} /> {directory.emergency_email}
                  </a>
                </li>
              ) : null}
            </ul>
          )}
          {student ? (
            <div className="mt-4 rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Admins will see you as</p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.full_name || auth.displayName}
                {student.matricule ? <span className="ml-2 font-mono text-gold-700">{student.matricule}</span> : null}
              </p>
              <p className="mt-0.5">{student.program_name || "—"}{student.level_label ? ` · ${student.level_label}` : ""}</p>
            </div>
          ) : null}
        </Card>


        <Card className="lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="lifeRing" size={18} className="text-red-600" /> Send an emergency message
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Only the administration team sees this. For anything urgent, choose “Urgent” — admins
            are alerted immediately.
          </p>
          <FormGrid className="mt-4">
            <Field label="What is this about?" required>
              <Select value={form.category} onChange={(e) => set("category", e.target.value)} options={EMERGENCY_CATEGORIES} />
            </Field>
            <Field label="Priority" required>
              <Select value={form.priority} onChange={(e) => set("priority", e.target.value)} options={EMERGENCY_PRIORITIES} />
            </Field>
            <Field label="Subject" required className="sm:col-span-2">
              <TextInput value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Medical emergency at Block B hostel" maxLength={200} required />
            </Field>
            <Field label="What happened? What help do you need?" required className="sm:col-span-2" hint="At least 10 characters — where you are and how admins can reach you speeds up help.">
              <TextArea rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Describe the emergency, who is affected, and what has already been done…" required />
            </Field>
            <Field label="Your phone (best number to reach you)">
              <TextInput value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder={student.phone || "+237 6XX XXX XXX"} maxLength={32} />
            </Field>
            <Field label="Your email">
              <TextInput type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder={student.email || "you@example.com"} />
            </Field>
            <Field label="Location (optional)" className="sm:col-span-2">
              <TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Block B hostel, Room 214" maxLength={255} />
            </Field>
          </FormGrid>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="danger" icon="send" loading={submitting} disabled={!canSubmit} onClick={submit}>
              Send to administration
            </Button>
            <span className="text-xs text-slate-400">
              Prefilled from your profile: {student.phone || student.email || "add a phone/email above"}.
            </span>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-brand-950">
        My messages {mine.data?.unread_replies ? <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{mine.data.unread_replies} new</span> : null}
      </h2>
      {mine.loading && !mine.data ? (
        <LoadingState label="Loading your messages…" />
      ) : mine.error ? (
        <ErrorState error={mine.error} onRetry={mine.reload} />
      ) : contacts.length === 0 ? (
        <EmptyState icon="lifeRing" title="No emergency messages yet" message="Messages you send to administration — and their replies — will appear here." />
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              action={({ contact, unreadReply }) =>
                unreadReply ? (
                  <Button size="sm" variant="secondary" onClick={async () => {
                    try {
                      await api(`/student/emergency-contacts/${contact.id}/read`, { method: "POST", body: {} });
                      mine.reload();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}>
                    Mark reply as read
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}



export function AdminEmergencyContactsPage() {
  const toast = useToast();
  const summary = useApi("/admin/emergency-contacts/summary/");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ status, priority, category, search }).filter(([, v]) => v),
    ),
  ).toString();
  const path = `/admin/emergency-contacts/${query ? `?${query}` : ""}`;
  const list = usePagedList(path, {
    pageSize: 15,
    deps: [status, priority, category, search],
  });
  const selected =
    list.rows.find((c) => c.id === selectedId) || list.rows[0] || null;
  const s = summary.data || {};

  async function select(contact) {
    setSelectedId(contact.id);
    setReply(contact.admin_reply || "");
    setNewStatus(contact.status);
    if (!contact.admin_read_at) {
      try {
        await api(`/admin/emergency-contacts/${contact.id}/mark-read/`, {
          method: "POST",
          body: {},
        });
        list.reload();
        summary.reload();
      } catch {
        /* opening the case must still work if marking read fails */
      }
    }
  }

  async function save(action) {
    if (!selected) return;
    setSaving(true);
    try {
      const body = {};
      if (action === "reply" || action === "save") {
        if (reply.trim()) body.admin_reply = reply.trim();
        if (newStatus && newStatus !== selected.status) body.status = newStatus;
      }
      if (action === "resolve") body.status = "resolved";
      if (action === "close") body.status = "closed";
      if (action === "reopen") body.status = "open";
      const updated = await api(`/admin/emergency-contacts/${selected.id}/`, {
        method: "PATCH",
        body,
      });
      toast.success(
        action === "reply"
          ? "Reply sent to the student."
          : `Case marked ${updated.status.replace("_", " ")}.`,
      );
      list.reload();
      summary.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Emergency contacts"
        subtitle="Urgent student messages for administration. New urgent cases also arrive as a notification (bell) and, when SMTP is configured, by email."
        actions={
          <Button variant="secondary" size="sm" icon="refresh" onClick={() => { list.reload(); summary.reload(); }}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open cases" value={formatNumber(s.open || 0)} icon="lifeRing" tone="red" />
        <StatCard label="In progress" value={formatNumber(s.in_progress || 0)} icon="clock" tone="gold" />
        <StatCard label="Urgent — needs attention" value={formatNumber(s.urgent_open || 0)} icon="alert" tone="red" />
        <StatCard label="Unread" value={formatNumber(s.unread || 0)} hint="Open / in-progress, never opened" icon="bell" tone="blue" />
      </div>

      <Card pad={false} className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={EMERGENCY_STATUSES} className="w-44" />
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="All priorities" options={EMERGENCY_PRIORITIES.map((p) => ({ value: p.value, label: humanize(p.value) }))} className="w-44" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={EMERGENCY_CATEGORIES} className="w-52" />
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, student, matricule…" className="min-w-56 flex-1" />
        </div>
      </Card>


      {list.loading && !list.rows.length ? (
        <LoadingState label="Loading emergency cases…" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState icon="lifeRing" title="No emergency cases" message="No student emergency messages match this view." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="space-y-3 xl:col-span-3">
            {list.rows.map((c) => {
              const active = selected && c.id === selected.id;
              const unread = !c.admin_read_at && ["open", "in_progress"].includes(c.status);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left shadow-sm transition ${
                    active
                      ? "border-brand-600 bg-brand-50/70 ring-1 ring-brand-600"
                      : "border-slate-200/80 bg-white hover:border-brand-300"
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.subject}</span>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    {unread ? (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-500">{c.message}</span>
                  <span className="mt-1.5 block text-xs text-slate-400">
                    {c.student_name} · {c.student_matricule || "—"} ·{" "}
                    {EMERGENCY_CATEGORY_LABEL[c.category] || humanize(c.category)} ·{" "}
                    {formatDateTime(c.created_at)}
                  </span>
                </button>
              );
            })}
            {list.pageCount > 1 ? (
              <div className="flex justify-center pt-1">
                <Pagination page={list.page} pageCount={list.pageCount} onPage={list.setPage} count={list.count} pageSize={list.pageSize} />
              </div>
            ) : null}
          </div>


          <Card className="h-fit xl:col-span-2">
            {selected ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-brand-950">{selected.subject}</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(selected.created_at)} ·{" "}
                      {EMERGENCY_CATEGORY_LABEL[selected.category] || humanize(selected.category)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <PriorityBadge priority={selected.priority} />
                    <StatusBadge status={selected.status} />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Student</dt>
                    <dd className="mt-0.5 font-medium text-slate-800">
                      {selected.student_name}
                      <span className="block font-mono text-xs text-gold-700">{selected.student_matricule || "—"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Program</dt>
                    <dd className="mt-0.5 text-slate-700">{selected.program_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Phone</dt>
                    <dd className="mt-0.5">
                      {selected.contact_phone ? (
                        <a href={`tel:${selected.contact_phone.replace(/\s+/g, "")}`} className="font-semibold text-brand-700 hover:underline">{selected.contact_phone}</a>
                      ) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Email</dt>
                    <dd className="mt-0.5 break-all">
                      {selected.contact_email ? (
                        <a href={`mailto:${selected.contact_email}`} className="font-semibold text-brand-700 hover:underline">{selected.contact_email}</a>
                      ) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Location</dt>
                    <dd className="mt-0.5 text-slate-700">{selected.location || "—"}</dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Student message</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selected.message}</p>
                </div>
                {selected.assigned_to_name || selected.resolved_by_name ? (
                  <p className="mt-3 text-xs text-slate-400">
                    {selected.assigned_to_name ? <>Assigned to {selected.assigned_to_name}. </> : null}
                    {selected.resolved_by_name ? <>Resolved by {selected.resolved_by_name} · {formatDateTime(selected.resolved_at)}. </> : null}
                    {selected.first_response_at ? <>First reply {formatDateTime(selected.first_response_at)}.</> : null}
                  </p>
                ) : null}


                <div className="mt-4 space-y-3">
                  <Field label="Reply to student">
                    <TextArea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Tell the student what is being done and what to do next…" />
                  </Field>
                  <Field label="Move case to">
                    <Select value={newStatus || selected.status} onChange={(e) => setNewStatus(e.target.value)} options={EMERGENCY_STATUSES} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button icon="send" loading={saving} disabled={!reply.trim()} onClick={() => save("reply")}>
                      Send reply
                    </Button>
                    <Button variant="secondary" loading={saving} onClick={() => save("save")}>
                      Save status
                    </Button>
                    {selected.status !== "resolved" ? (
                      <Button variant="secondary" loading={saving} onClick={() => save("resolve")}>Resolve</Button>
                    ) : null}
                    {selected.status !== "closed" ? (
                      <Button variant="secondary" loading={saving} onClick={() => save("close")}>Close</Button>
                    ) : null}
                    {["resolved", "closed"].includes(selected.status) ? (
                      <Button variant="ghost" loading={saving} onClick={() => save("reopen")}>Reopen</Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon="lifeRing" title="Select a case" message="Choose an emergency message to reply, assign or resolve it." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

