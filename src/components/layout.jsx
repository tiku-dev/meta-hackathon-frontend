import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./icons";
import { ErrorBoundary, Spinner } from "./ui";
import { Avatar } from "./ui-parts";
import { roleLabel, useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { UNIVERSITY_NAME } from "../lib/config";

export const NAV_SECTIONS = [
  {
    title: "Overview",
    roles: null,
    items: [{ to: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "My studies",
    roles: ["student"],
    items: [
      { to: "/registration", label: "Course registration", icon: "edit" },
      { to: "/timetable", label: "Timetable", icon: "calendar" },
      { to: "/fees", label: "Fees & payments", icon: "wallet" },
      { to: "/receipts", label: "Receipts", icon: "receipt" },
      { to: "/results", label: "My results", icon: "award" },
      { to: "/transcript", label: "Transcript", icon: "file" },
    ],
  },
  {
    title: "Teaching",
    roles: ["lecturer", "hod", "admin", "super_admin"],
    items: [
      { to: "/teaching/classes", label: "My classes & marks", icon: "book", roles: ["lecturer", "hod"] },
      { to: "/offerings", label: "Course offerings", icon: "layers" },
      {
        to: "/timetable",
        label: "Timetable",
        icon: "calendar",
        roles: ["lecturer", "hod", "admin", "super_admin", "registrar", "coordinator"],
      },
      {
        to: "/results-review",
        label: "Results review",
        icon: "award",
        roles: ["admin", "super_admin", "registrar", "hod"],
      },
    ],
  },
  {
    title: "Department",
    roles: ["hod"],
    items: [
      { to: "/hod", label: "Department overview", icon: "building" },
      { to: "/hod/marks-upload", label: "Marks upload", icon: "upload" },
    ],
  },
  {
    title: "Administration",
    roles: ["admin", "super_admin", "admissions", "finance", "registrar", "coordinator"],
    items: [
      {
        to: "/admin/students",
        label: "Students",
        icon: "users",
        roles: ["admin", "super_admin", "admissions", "registrar", "finance", "hod"],
      },
      { to: "/admin/lecturers", label: "Lecturers", icon: "cap", roles: ["admin", "super_admin"] },
      { to: "/admin/hods", label: "Heads of Department", icon: "building", roles: ["admin", "super_admin"] },
      {
        to: "/admin/academics",
        label: "Academic structure",
        icon: "building",
        roles: ["admin", "super_admin", "registrar", "coordinator"],
      },
      { to: "/admin/finance", label: "Finance", icon: "wallet", roles: ["admin", "super_admin", "finance"] },
      {
        to: "/admin/results-admin",
        label: "Grading & transcripts",
        icon: "award",
        roles: ["admin", "super_admin", "registrar"],
      },
    ],
  },
  {
    title: "Insights",
    roles: ["admin", "super_admin", "finance", "registrar"],
    items: [
      { to: "/admin/reports", label: "Reports", icon: "chart" },
      { to: "/admin/audit", label: "Audit log", icon: "history", roles: ["admin", "super_admin"] },
    ],
  },
  {
    title: "Communication",
    roles: null,
    items: [
      { to: "/announcements", label: "Announcements", icon: "megaphone" },
      { to: "/events", label: "Events", icon: "calendar" },
      { to: "/notifications", label: "Notifications", icon: "bell" },
    ],
  },
];

function visibleSections(roles) {
  const has = (...w) => roles.includes("super_admin") || w.some((r) => roles.includes(r));
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || has(...item.roles)),
  })).filter((section) => section.items.length > 0 && (!section.roles || has(...section.roles)));
}

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    const load = () =>
      api("/notifications/unread-count/")
        .then((d) => alive && setUnread(d?.unread || 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-800"
      aria-label="Notifications"
    >
      <Icon name="bell" size={20} />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export function AppLayout() {
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const sections = visibleSections(auth.roles);

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      <Link to="/dashboard" className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-brand-950 shadow-lg shadow-black/20">
          <Icon name="cap" size={24} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[17px] font-semibold leading-tight text-white">
            {UNIVERSITY_NAME}
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-widest text-brand-300">
            School Management
          </span>
        </span>
      </Link>

      <nav className="nice-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition ${
                        isActive
                          ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                          : "text-brand-200 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <Icon name={item.icon} size={17} className="shrink-0 opacity-90" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={auth.displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{auth.displayName}</p>
            <p className="truncate text-xs text-brand-300">
              {auth.roles.map(roleLabel).join(" · ") || auth.user?.email}
            </p>
          </div>
          <button
            onClick={auth.logout}
            className="rounded-lg p-2 text-brand-300 transition hover:bg-white/10 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
        {(auth.student?.matricule || auth.lecturer?.lecturer_code) && (
          <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-gold-300">
            {auth.student?.matricule || auth.lecturer?.lecturer_code}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-brand-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/60 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-950">
                {auth.student
                  ? `${auth.student.program_name || "Student"} · ${auth.student.level_label || ""}`
                  : auth.lecturer
                    ? auth.lecturer.department_name || "Lecturer"
                    : UNIVERSITY_NAME}
              </p>
              <p className="truncate text-xs text-slate-500">{auth.user?.email}</p>
            </div>
            <NotificationBell />
            <Link
              to="/notifications"
              className="hidden items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 sm:inline-flex"
            >
              <Icon name="bell" size={15} /> Inbox
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        <footer className="border-t border-slate-200/70 py-4 text-center text-xs text-slate-400">
          {UNIVERSITY_NAME} · School Management System · All times Africa/Douala
        </footer>
      </div>
    </div>
  );
}

/* ---------------- Route guards ---------------- */

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-slate-500">
        <Spinner className="text-brand-700" /> Loading your portal…
      </div>
    );
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <AppLayout />;
}

export function RequireRole({ roles, children }) {
  const auth = useAuth();
  if (!auth.has(...roles)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
        <p className="font-display text-lg font-semibold text-amber-900">Access restricted</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
          This area needs one of these roles: {roles.join(", ")}. You are signed in as{" "}
          {auth.roles.join(", ") || "—"}.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-sm font-semibold text-brand-700 underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }
  return children;
}


