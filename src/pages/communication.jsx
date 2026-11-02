import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { Welcome } from "./dashboards";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApi, usePagedList } from "../lib/hooks";
import { formatDateTime, formatNumber } from "../lib/format";

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
