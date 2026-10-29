import { useState } from "react";
import { Button, PageHeader, StatusBadge, useToast } from "../components/ui";
import { ResourcePage } from "../components/crud";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { invalidateLookups } from "../lib/lookups";
import { formatDate, formatDateTime } from "../lib/format";

const YES_NO = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];
const boolText = (v) => (v ? "Yes" : "No");

const tabs = [
  { key: "units", label: "Academic units" },
  { key: "programs", label: "Programs" },
  { key: "levels", label: "Levels" },
  { key: "years", label: "Academic years" },
  { key: "semesters", label: "Semesters" },
  { key: "courses", label: "Courses" },
  { key: "mappings", label: "Program courses" },
  { key: "exemptions", label: "Exemptions" },
];

export function AcademicsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("units");
  const canWrite = auth.has("admin", "super_admin", "registrar", "coordinator");
  const canSemesterWindow = auth.has("admin", "super_admin");

  async function setRegistration(row, open, ctx) {
    try {
      await api(`/admin/semesters/${row.id}/${open ? "open-registration" : "close-registration"}/`, {
        method: "POST",
        body: {},
      });
      toast.success(open ? "Registration opened." : "Registration closed.");
      ctx.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const resources = {
    units: {
      title: "Academic units",
      subtitle: "Faculties, schools, institutes and departments — nestable.",
      path: "/admin/academic-units/",
      singular: "Unit",
      canWrite,
      onSaved: () => invalidateLookups("units"),
      fields: [
        { name: "name", label: "Name", required: true, span: 2 },
        {
          name: "unit_type",
          label: "Unit type",
          type: "select",
          options: ["university", "faculty", "school", "institute", "department"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          })),
        },
        { name: "parent", label: "Parent unit", type: "lookup", lookup: "units" },
        { name: "code", label: "Code" },
        { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active" },
      ],
      filters: [
        { name: "unit_type", label: "All types", options: ["university", "faculty", "school", "institute", "department"].map((v) => ({ value: v, label: v })) },
        { name: "is_active", label: "Active?", options: YES_NO },
      ],
      columns: [
        { key: "name", header: "Unit", render: (u) => <span className="font-medium text-slate-800">{u.name}</span> },
        { key: "unit_type", header: "Type" },
        { key: "code", header: "Code", render: (u) => u.code || "—" },
        { key: "parent", header: "Parent", render: (u, ctx) => ctx.label(ctx.lookups.units, u.parent) },
        { key: "is_active", header: "Active", render: (u) => boolText(u.is_active) },
      ],
    },
    programs: {
      title: "Programs",
      subtitle: "Degree programs owned by a department.",
      path: "/admin/programs/",
      singular: "Program",
      canWrite,
      onSaved: () => invalidateLookups("programs"),
      fields: [
        { name: "name", label: "Program name", required: true, span: 2 },
        { name: "department", label: "Department", type: "lookup", lookup: "units", required: true },
        { name: "award", label: "Award", placeholder: "BSc, MSc, HND…" },
        { name: "duration_years", label: "Duration (years)", type: "number", min: 1 },
        { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active" },
      ],
      filters: [
        { name: "department", label: "All departments", lookup: "units" },
        { name: "is_active", label: "Active?", options: YES_NO },
      ],
      columns: [
        { key: "name", header: "Program", render: (p) => <span className="font-medium text-slate-800">{p.name}</span> },
        { key: "department_name", header: "Department" },
        { key: "award", header: "Award", render: (p) => p.award || "—" },
        { key: "duration_years", header: "Years" },
        { key: "is_active", header: "Active", render: (p) => boolText(p.is_active) },
      ],
    },

    levels: {
      title: "Levels",
      subtitle: "Ordered levels inside a program, with an optional credit cap.",
      path: "/admin/levels/",
      singular: "Level",
      canWrite,
      onSaved: () => invalidateLookups("levels"),
      fields: [
        { name: "program", label: "Program", type: "lookup", lookup: "programs", required: true },
        { name: "label", label: "Label", required: true, placeholder: "Level 200" },
        { name: "order", label: "Order", type: "number", required: true, min: 1 },
        { name: "default_max_credits", label: "Default max credits (blank = university default)", type: "number", min: 1 },
      ],
      filters: [{ name: "program", label: "All programs", lookup: "programs" }],
      columns: [
        { key: "label", header: "Level", render: (l) => <span className="font-medium text-slate-800">{l.label}</span> },
        { key: "program", header: "Program", render: (l, ctx) => ctx.label(ctx.lookups.programs, l.program) },
        { key: "order", header: "Order" },
        { key: "default_max_credits", header: "Credit cap", render: (l) => l.default_max_credits ?? "Default" },
      ],
    },
    years: {
      title: "Academic years",
      path: "/admin/academic-years/",
      singular: "Academic year",
      canWrite,
      onSaved: () => invalidateLookups("years"),
      fields: [
        { name: "label", label: "Label", required: true, placeholder: "2025/2026" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "closed", label: "Closed" },
          ],
        },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
      ],
      filters: [{ name: "status", label: "All statuses", options: [
        { value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" },
      ]}],
      columns: [
        { key: "label", header: "Year", render: (y) => <span className="font-medium text-slate-800">{y.label}</span> },
        { key: "start_date", header: "Starts", render: (y) => formatDate(y.start_date) },
        { key: "end_date", header: "Ends", render: (y) => formatDate(y.end_date) },
        { key: "status", header: "Status", render: (y) => <StatusBadge status={y.status} /> },
      ],
    },
    semesters: {
      title: "Semesters",
      subtitle: "Registration windows and fee deadlines live here — configuration, not code.",
      path: "/admin/semesters/",
      singular: "Semester",
      canWrite,
      onSaved: () => invalidateLookups("semesters"),
      fields: [
        { name: "academic_year", label: "Academic year", type: "lookup", lookup: "years", required: true },
        {
          name: "semester_type",
          label: "Semester type",
          type: "select",
          required: true,
          options: [
            { value: "first", label: "First" },
            { value: "second", label: "Second" },
            { value: "resit", label: "Resit" },
          ],
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
          ],
        },
        { name: "registration_open", label: "Registration open", type: "checkbox", checkboxLabel: "Registration window is open" },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
        { name: "registration_opens_at", label: "Registration opens at", type: "datetime" },
        { name: "registration_deadline", label: "Registration deadline", type: "datetime" },
        { name: "fee_deadline", label: "Fee deadline", type: "datetime", span: 2 },
      ],
      filters: [
        { name: "academic_year", label: "All years", lookup: "years" },
        { name: "status", label: "All statuses", options: [
          { value: "draft", label: "Draft" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" },
        ]},
      ],
      columns: [
        { key: "label", header: "Semester", render: (s) => `${s.academic_year_label} · ${s.semester_type}` },
        { key: "registration_deadline", header: "Registration deadline", render: (s) => formatDateTime(s.registration_deadline) },
        { key: "fee_deadline", header: "Fee deadline", render: (s) => formatDateTime(s.fee_deadline) },
        { key: "registration_open", header: "Window", render: (s) => (s.registration_open ? "Open" : "Closed") },
        { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
      ],
      actions: (row, ctx) =>
        canSemesterWindow ? (
          row.registration_open ? (
            <Button size="sm" variant="secondary" onClick={() => setRegistration(row, false, ctx)}>Close registration</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setRegistration(row, true, ctx)}>Open registration</Button>
          )
        ) : null,
    },

    courses: {
      title: "Course catalog",
      subtitle: "Courses belong to a department and carry credit values.",
      path: "/admin/courses/",
      singular: "Course",
      canWrite,
      onSaved: () => invalidateLookups("courses"),
      fields: [
        { name: "code", label: "Course code", required: true, placeholder: "CSC 201" },
        { name: "title", label: "Title", required: true },
        { name: "department", label: "Department", type: "lookup", lookup: "units" },
        { name: "credits", label: "Credits", type: "number", required: true, min: 0 },
        { name: "description", label: "Description", type: "textarea", span: 2 },
        { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active" },
      ],
      filters: [
        { name: "department", label: "All departments", lookup: "units" },
        { name: "is_active", label: "Active?", options: YES_NO },
      ],
      columns: [
        { key: "code", header: "Code", render: (c) => <span className="font-mono font-bold text-brand-900">{c.code}</span> },
        { key: "title", header: "Title", render: (c) => <span className="font-medium text-slate-800">{c.title}</span> },
        { key: "department", header: "Department", render: (c, ctx) => ctx.label(ctx.lookups.units, c.department) },
        { key: "credits", header: "Credits" },
        { key: "is_active", header: "Active", render: (c) => boolText(c.is_active) },
      ],
    },
    mappings: {
      title: "Program-course mapping",
      subtitle: "Which courses belong to a program/level/semester, what is required, and prerequisites.",
      path: "/admin/program-courses/",
      singular: "Mapping",
      canWrite,
      fields: [
        { name: "program", label: "Program", type: "lookup", lookup: "programs", required: true },
        { name: "level", label: "Level", type: "lookup", lookup: "levels" },
        { name: "course", label: "Course", type: "lookup", lookup: "courses", required: true, optionLabel: (r) => `${r.code} — ${r.title}` },
        {
          name: "semester_type",
          label: "Semester type",
          type: "select",
          options: [
            { value: "first", label: "First" },
            { value: "second", label: "Second" },
            { value: "resit", label: "Resit" },
          ],
        },
        { name: "prerequisite", label: "Prerequisite course", type: "lookup", lookup: "courses", optionLabel: (r) => `${r.code} — ${r.title}` },
        { name: "is_required", label: "Required", type: "checkbox", checkboxLabel: "Required course" },
      ],
      filters: [
        { name: "program", label: "All programs", lookup: "programs" },
        { name: "level", label: "All levels", lookup: "levels" },
      ],
      columns: [
        { key: "course_code", header: "Course", render: (m) => <span className="font-mono font-bold text-brand-900">{m.course_code}</span> },
        { key: "course_title", header: "Title" },
        { key: "program", header: "Program", render: (m, ctx) => ctx.label(ctx.lookups.programs, m.program) },
        { key: "level", header: "Level", render: (m, ctx) => ctx.label(ctx.lookups.levels, m.level) },
        { key: "semester_type", header: "Semester" },
        { key: "is_required", header: "Required", render: (m) => boolText(m.is_required) },
      ],
    },




    exemptions: {
      title: "Registration exemptions",
      subtitle: "Recorded admin exceptions: late registration, fee waiver or extra credits. Every grant is audited.",
      path: "/admin/exemptions/",
      singular: "Exemption",
      canWrite: auth.has("admin", "super_admin", "registrar"),
      fields: [
        { name: "student", label: "Student", type: "lookup", lookup: "students", required: true, optionLabel: (r) => `${r.matricule || "no matricule"} — ${r.full_name}` },
        { name: "semester", label: "Semester", type: "lookup", lookup: "semesters", required: true, optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
        {
          name: "exemption_type",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { value: "late_registration", label: "Late registration" },
            { value: "fee_waiver", label: "Fee waiver" },
            { value: "credit_override", label: "Credit override" },
          ],
        },
        { name: "extra_credits", label: "Extra credits (credit override)", type: "number", min: 0 },
        { name: "reason", label: "Reason", type: "textarea", required: true, span: 2 },
        { name: "is_active", label: "Active", type: "checkbox", checkboxLabel: "Active" },
      ],
      filters: [
        { name: "semester", label: "All semesters", lookup: "semesters", optionLabel: (r) => `${r.academic_year_label} · ${r.semester_type}` },
        {
          name: "exemption_type",
          label: "All types",
          options: [
            { value: "late_registration", label: "Late registration" },
            { value: "fee_waiver", label: "Fee waiver" },
            { value: "credit_override", label: "Credit override" },
          ],
        },
      ],
      columns: [
        { key: "student", header: "Student", render: (x, ctx) => ctx.label(ctx.lookups.students, x.student) },
        { key: "exemption_type", header: "Type" },
        { key: "semester", header: "Semester", render: (x, ctx) => ctx.label(ctx.lookups.semesters, x.semester) },
        { key: "extra_credits", header: "Extra credits" },
        { key: "is_active", header: "Active", render: (x) => boolText(x.is_active) },
        { key: "reason", header: "Reason", render: (x) => <span className="line-clamp-2 text-slate-500">{x.reason}</span> },
      ],
    },
  };


  return (
    <div>
      <PageHeader
        title="Academic structure"
        subtitle="University structure and rules are data, not code: units, programs, levels, years, semesters, catalog, mappings and exemptions."
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
      <div key={tab}>
        <ResourcePage resource={resources[tab]} />
      </div>
    </div>
  );
}
