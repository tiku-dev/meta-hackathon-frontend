import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  useToast,
} from "../components/ui";
import { ResourcePage } from "../components/crud";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { formatDate, formatTime } from "../lib/format";

const offeringFields = [
  { name: "course", label: "Course", type: "lookup", lookup: "courses", required: true, optionLabel: (r) => `${r.code} — ${r.title}` },
  { name: "program", label: "Program", type: "lookup", lookup: "programs" },
  { name: "level", label: "Level", type: "lookup", lookup: "levels" },
  { name: "semester", label: "Semester", type: "lookup", lookup: "semesters", required: true, optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
  { name: "lecturer", label: "Lecturer", type: "lookup", lookup: "lecturers" },
  { name: "capacity", label: "Capacity", type: "number", min: 1 },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "closed", label: "Closed" },
    ],
  },
];

const sessionFields = [
  { name: "offering", label: "Offering", type: "number", required: true, hint: "Offering ID — see the offerings table above." },
  {
    name: "weekday",
    label: "Weekday (weekly session)",
    type: "select",
    placeholder: "One-off dated session",
    options: [
      { value: 0, label: "Monday" },
      { value: 1, label: "Tuesday" },
      { value: 2, label: "Wednesday" },
      { value: 3, label: "Thursday" },
      { value: 4, label: "Friday" },
      { value: 5, label: "Saturday" },
      { value: 6, label: "Sunday" },
    ],
  },
  { name: "session_date", label: "Session date (one-off only)", type: "date" },
  { name: "start_time", label: "Start time", type: "time", required: true },
  { name: "end_time", label: "End time", type: "time", required: true },
  { name: "room", label: "Room" },
  { name: "campus", label: "Campus" },
  { name: "is_published", label: "Published", type: "checkbox", checkboxLabel: "Visible on timetables" },
];

function prepSession(payload) {
  const next = { ...payload };
  if (next.weekday === "" || next.weekday === null) next.weekday = null;
  if (next.session_date === "") next.session_date = null;
  if (next.start_time && next.start_time.length === 5) next.start_time = `${next.start_time}:00`;
  if (next.end_time && next.end_time.length === 5) next.end_time = `${next.end_time}:00`;
  return next;
}

export function OfferingsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // { kind: "sessions"|"roster"|"conflicts", offering }
  const canWrite = auth.has("admin", "super_admin", "registrar", "coordinator", "hod");

  return (
    <div>
      <PageHeader
        title="Course offerings"
        subtitle="An offering is a course actually running in a semester, with a lecturer, capacity and timetable. HODs only see and propose offerings for their own department."
      />
      <ResourcePage
        resource={{
          title: "Offerings",
          subtitle: "Publish an offering before students can register for it.",
          path: "/admin/course-offerings/",
          singular: "Offering",
          canWrite,
          fields: offeringFields,
          filters: [
            {
              name: "status",
              label: "All statuses",
              options: [
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
                { value: "closed", label: "Closed" },
              ],
            },
            { name: "lecturer", label: "All lecturers", lookup: "lecturers" },
          ],
          columns: [
            {
              key: "course",
              header: "Course",
              render: (o) => (
                <span>
                  <span className="font-mono font-bold text-brand-900">{o.course_code}</span>{" "}
                  <span className="text-slate-600">{o.course_title}</span>
                </span>
              ),
            },
            { key: "semester_label", header: "Semester" },
            { key: "lecturer_name", header: "Lecturer", render: (o) => o.lecturer_name || "Unassigned" },
            { key: "enrolled", header: "Enrolled", render: (o) => `${o.enrolled_count} / ${o.capacity}` },
            { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
          ],
          actions: (o) => (
            <>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "sessions", offering: o })}>
                Sessions
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "roster", offering: o })}>
                Roster
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "conflicts", offering: o })}>
                Conflicts
              </Button>
              <Link to={`/results-review?offering=${o.id}`}>
                <Button size="sm" variant="secondary">Results</Button>
              </Link>
            </>
          ),
        }}
      />

      <div className="mt-4">
        <ResourcePage
          resource={{
            title: "Timetable sessions",
            subtitle: "Weekly or one-off sessions attached to offerings. Publishing controls timetable visibility.",
            path: "/admin/timetable-sessions/",
            singular: "Session",
            canWrite,
            fields: sessionFields,
            transformSubmit: prepSession,
            columns: [
              { key: "offering", header: "Offering", render: (s) => `#${s.offering}` },
              { key: "course_code", header: "Course", render: (s) => <span className="font-mono font-bold text-brand-900">{s.course_code}</span> },
              { key: "when", header: "When", render: (s) => s.weekday_label || formatDate(s.session_date) },
              { key: "time", header: "Time", render: (s) => `${formatTime(s.start_time)} – ${formatTime(s.end_time)}` },
              { key: "room", header: "Room", render: (s) => [s.room, s.campus].filter(Boolean).join(" · ") || "—" },
              { key: "is_published", header: "Published", render: (s) => (s.is_published ? "Yes" : "No") },
            ],
          }}
        />
      </div>

      {dialog?.kind === "roster" ? (
        <RosterDialog offering={dialog.offering} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "conflicts" ? (
        <ConflictsDialog offering={dialog.offering} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "sessions" ? (
        <SessionsDialog offering={dialog.offering} onClose={() => setDialog(null)} toast={toast} />
      ) : null}
    </div>
  );
}

function RosterDialog({ offering, onClose }) {
  const roster = useApi(`/admin/course-offerings/${offering.id}/roster/`);
  return (
    <Modal open onClose={onClose} wide title={`Roster — ${offering.course_code}`} subtitle={offering.course_title}>
      {roster.loading ? (
        <LoadingState />
      ) : roster.error ? (
        <ErrorState error={roster.error} onRetry={roster.reload} />
      ) : (
        <DataTable
          columns={[
            { key: "student_matricule", header: "Matricule", render: (r) => <span className="font-mono text-xs font-semibold">{r.student_matricule}</span> },
            { key: "student_name", header: "Student" },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={roster.data || []}
          empty={<EmptyState icon="users" title="No students enrolled" />}
        />
      )}
    </Modal>
  );
}

function ConflictsDialog({ offering, onClose }) {
  const conflicts = useApi(`/admin/course-offerings/${offering.id}/conflicts/`);
  const rows = conflicts.data?.conflicts || [];
  return (
    <Modal open onClose={onClose} title={`Timetable conflicts — ${offering.course_code}`} subtitle={offering.semester_label || ""}>
      {conflicts.loading ? (
        <LoadingState />
      ) : conflicts.error ? (
        <ErrorState error={conflicts.error} onRetry={conflicts.reload} />
      ) : rows.length === 0 ? (
        <Alert tone="success">No lecturer, room or program/level conflicts detected for this offering.</Alert>
      ) : (
        <ul className="space-y-2">
          {rows.map((c, i) => (
            <li key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{c}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function SessionsDialog({ offering, onClose }) {
  const sessions = useApi(`/admin/timetable-sessions/?offering=${offering.id}&page_size=100`);
  const rows = sessions.data?.results || [];
  return (
    <Modal open onClose={onClose} wide title={`Sessions — ${offering.course_code}`} subtitle="Add or edit sessions in the Timetable sessions table below.">
      {sessions.loading ? (
        <LoadingState />
      ) : sessions.error ? (
        <ErrorState error={sessions.error} onRetry={sessions.reload} />
      ) : (
        <DataTable
          columns={[
            { key: "when", header: "When", render: (s) => s.weekday_label || formatDate(s.session_date) },
            { key: "time", header: "Time", render: (s) => `${formatTime(s.start_time)} – ${formatTime(s.end_time)}` },
            { key: "room", header: "Room", render: (s) => [s.room, s.campus].filter(Boolean).join(" · ") || "—" },
            { key: "is_published", header: "Published", render: (s) => (s.is_published ? "Yes" : "No") },
          ]}
          rows={rows}
          empty={<EmptyState icon="calendar" title="No sessions yet" message="Add one from the Timetable sessions table on this page." />}
        />
      )}
    </Modal>
  );
}


