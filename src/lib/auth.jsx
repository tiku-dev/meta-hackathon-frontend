import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onAuthChange, tokens } from "./api";

const AuthContext = createContext(null);

export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "admissions",
  "finance",
  "registrar",
  "coordinator",
];

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function roleLabel(role) {
  return (
    {
      super_admin: "Super admin",
      admin: "Administrator",
      admissions: "Admissions staff",
      finance: "Finance officer",
      registrar: "Registrar / Exams officer",
      hod: "Head of Department",
      coordinator: "Coordinator",
      lecturer: "Lecturer",
      student: "Student",
    }[role] || role
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [student, setStudent] = useState(null);
  const [lecturer, setLecturer] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));
  const [error, setError] = useState("");

  const loadMe = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setRoles([]);
      setStudent(null);
      setLecturer(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const me = await api("/me/");
      setUser(me.user);
      setRoles(me.roles || me.user?.roles || []);
      setStudent(me.student || null);
      setLecturer(me.lecturer || null);
      setError("");
      return me;
    } catch (err) {
      if (err.status === 401) tokens.clear();
      setUser(null);
      setRoles([]);
      setStudent(null);
      setLecturer(null);
      setError(err.message || "");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial profile load + subscribe to token changes (logout elsewhere).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe();
    return onAuthChange(() => {
      if (!tokens.access) {
        setUser(null);
        setRoles([]);
        setStudent(null);
        setLecturer(null);
        setLoading(false);
      }
    });
  }, [loadMe]);

  const login = useCallback(
    async (identifier, password) => {
      // Students sign in with their matricule, staff with their email; the
      // backend resolves a matricule to the student's account.
      const data = await api("/auth/token/", {
        method: "POST",
        body: { username: identifier, password },
      });
      tokens.set(data.access, data.refresh);
      return loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
    setRoles([]);
    setStudent(null);
    setLecturer(null);
  }, []);

  const value = useMemo(() => {
    const has = (...wanted) =>
      roles.includes("super_admin") || wanted.some((r) => roles.includes(r));
    const displayName =
      student?.full_name ||
      lecturer?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.email ||
      "";
    return {
      user,
      roles,
      student,
      lecturer,
      loading,
      error,
      login,
      logout,
      refresh: loadMe,
      has,
      isAuthenticated: Boolean(user),
      isStudent: has("student"),
      isStaff: roles.some(isStaffRole),
      displayName,
      primaryRole: roles[0] || null,
    };
  }, [user, roles, student, lecturer, loading, error, login, logout, loadMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
