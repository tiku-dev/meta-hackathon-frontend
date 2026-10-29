import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/icons";
import { Alert, Button, Field, TextInput, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, UNIVERSITY_NAME } from "../lib/config";

export function AuthShell({ title, subtitle, children, sideNote }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-brand-950 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #dcb344 0, transparent 40%), radial-gradient(circle at 85% 80%, #268550 0, transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-brand-950">
            <Icon name="cap" size={24} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">{UNIVERSITY_NAME}</p>
            <p className="text-[11px] font-medium uppercase tracking-widest text-brand-300">
              School Management System
            </p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">{title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-brand-200">{subtitle}</p>
          {sideNote}
        </div>
        <p className="relative text-xs text-brand-400">
          Fees, deadlines and grading rules are configured by the university — nothing is hard-coded.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-paper px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-pop">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 text-gold-400">
              <Icon name="cap" size={22} />
            </span>
            <div>
              <p className="font-display font-semibold text-brand-950">{UNIVERSITY_NAME}</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">School Management</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Redirect already-signed-in users away from the login form.
  useEffect(() => {
    if (auth.isAuthenticated) navigate("/dashboard", { replace: true });
  }, [auth.isAuthenticated, navigate]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const me = await auth.login(identifier.trim(), password);
      toast.success(`Welcome back${me?.user?.first_name ? `, ${me.user.first_name}` : ""}.`);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Check your matricule/email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="One portal for the whole university."
      subtitle="Admissions and matricules, fee payments, course registration, timetables, results and transcripts — for administrators, lecturers and students."
      sideNote={
        <ul className="mt-6 space-y-2.5 text-sm text-brand-100">
          {[
            "Pay fees and unlock course registration",
            "Enter CA / exam marks and publish results",
            "Announcements, events and deadline alerts",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500/20 text-gold-300">
                <Icon name="check" size={12} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      }
    >
      <h2 className="font-display text-2xl font-semibold text-brand-950">Sign in</h2>
      <p className="mt-1 text-sm text-slate-500">
        Students sign in with their matricule. Staff sign in with their email address.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Matricule or email" required>
          <TextInput
            autoComplete="username"
            placeholder="UB26-COMP-0001 or you@university.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" required>
          <TextInput
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign in to the portal
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        New student with an activation code?{" "}
        <Link to="/activate" className="font-semibold text-brand-700 hover:underline">
          Activate your account
        </Link>
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Demo accounts · password {DEMO_PASSWORD}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.identifier}
              type="button"
              onClick={() => {
                setIdentifier(a.identifier);
                setPassword(DEMO_PASSWORD);
              }}
              className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs transition hover:bg-brand-50"
            >
              <span className="block font-semibold text-slate-700">{a.role}</span>
              <span className="block font-mono text-[11px] text-slate-400">{a.identifier}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function ActivatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    matricule: params.get("matricule") || "",
    email: params.get("email") || "",
    activation_code: params.get("token") || params.get("code") || "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError("");
    try {
      const data = await api("/auth/activate", {
        method: "POST",
        body: {
          matricule: form.matricule.trim(),
          email: form.email.trim(),
          activation_code: form.activation_code.trim(),
          password: form.password,
        },
      });
      setDone(data);
      toast.success("Account activated. You can now sign in with your matricule.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Claim your student account."
      subtitle="Admissions issued your matricule and activation code. Enter them exactly as given, choose a password, and you are in — your name comes from your student record."
    >
      <h2 className="font-display text-2xl font-semibold text-brand-950">Activate account</h2>
      <p className="mt-1 text-sm text-slate-500">
        Already activated?{" "}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>

      {done ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success" title="Account activated">
            <p>
              Welcome{done.name ? `, ${done.name}` : ""}. Matricule{" "}
              <span className="font-mono font-bold">{done.matricule}</span> is now active for{" "}
              {done.email}. Sign in with your matricule and password to view your fees and register courses.
            </p>
          </Alert>
          <Button className="w-full" size="lg" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Matricule" required hint="Exactly as issued by admissions.">
            <TextInput
              value={form.matricule}
              onChange={(e) => set("matricule", e.target.value)}
              placeholder="UB26-COMP-0001"
              autoComplete="username"
              required
              className="font-mono"
            />
          </Field>
          <Field label="Email address" required hint="The email address admissions has on record for you.">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Activation code" required hint="The one-time code from your admission email or the admissions office.">
            <TextInput
              value={form.activation_code}
              onChange={(e) => set("activation_code", e.target.value)}
              placeholder="Paste the one-time code"
              required
              className="font-mono text-xs"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" required hint="Minimum 8 characters.">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
            </Field>
            <Field label="Confirm password" required>
              <TextInput
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                required
              />
            </Field>
          </div>
          <Button type="submit" loading={busy} className="w-full" size="lg" variant="gold">
            Activate my account
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
