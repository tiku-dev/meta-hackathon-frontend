import { Component, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "./icons";
import { humanize } from "../lib/format";

/* ---------------- Buttons ---------------- */

const BTN = {
  primary:
    "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:ring-brand-600 disabled:bg-brand-300",
  gold: "bg-gold-500 text-brand-950 shadow-sm hover:bg-gold-400 focus-visible:ring-gold-500 disabled:opacity-60",
  secondary:
    "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-brand-600 disabled:opacity-60",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-brand-600 disabled:opacity-50",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500 disabled:opacity-60",
  dangerGhost: "text-red-600 hover:bg-red-50 focus-visible:ring-red-500 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  children,
  ...props
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${BTN[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner size={15} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ size = 18, className = "" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

/* ---------------- Cards & layout ---------------- */

export function Card({ className = "", children, pad = true }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(12,58,38,0.05)] ${pad ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-950 sm:text-[28px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    gold: "bg-gold-100 text-gold-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Card className="flex items-start gap-4">
      <div className={`rounded-xl p-2.5 ${tones[tone] || tones.brand}`}>
        <Icon name={icon || "chart"} size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </Card>
  );
}

/* ---------------- Badges ---------------- */

const STATUS_TONES = {
  active: "bg-brand-50 text-brand-700 ring-brand-200",
  paid: "bg-brand-50 text-brand-700 ring-brand-200",
  succeeded: "bg-brand-50 text-brand-700 ring-brand-200",
  published: "bg-brand-50 text-brand-700 ring-brand-200",
  approved: "bg-brand-50 text-brand-700 ring-brand-200",
  open: "bg-brand-50 text-brand-700 ring-brand-200",
  registered: "bg-brand-50 text-brand-700 ring-brand-200",
  present: "bg-brand-50 text-brand-700 ring-brand-200",
  going: "bg-brand-50 text-brand-700 ring-brand-200",
  issued: "bg-brand-50 text-brand-700 ring-brand-200",
  completed: "bg-brand-50 text-brand-700 ring-brand-200",
  locked: "bg-slate-100 text-slate-600 ring-slate-300",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  partially_paid: "bg-amber-50 text-amber-700 ring-amber-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  submitted: "bg-amber-50 text-amber-700 ring-amber-200",
  hod_approved: "bg-amber-50 text-amber-700 ring-amber-200",
  created: "bg-amber-50 text-amber-700 ring-amber-200",
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-200",
  resolved: "bg-brand-50 text-brand-700 ring-brand-200",
  maybe: "bg-amber-50 text-amber-700 ring-amber-200",
  late: "bg-amber-50 text-amber-700 ring-amber-200",
  unpaid: "bg-red-50 text-red-700 ring-red-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  needs_review: "bg-red-50 text-red-700 ring-red-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  absent: "bg-red-50 text-red-700 ring-red-200",
  withdrawn: "bg-red-50 text-red-700 ring-red-200",
  declined: "bg-slate-100 text-slate-500 ring-slate-300",
  closed: "bg-slate-100 text-slate-600 ring-slate-300",
  suspended: "bg-slate-100 text-slate-600 ring-slate-300",
  inactive: "bg-slate-100 text-slate-500 ring-slate-300",
  graduated: "bg-sky-50 text-sky-700 ring-sky-200",
  excused: "bg-sky-50 text-sky-700 ring-sky-200",
  dropped: "bg-slate-100 text-slate-500 ring-slate-300",
  refunded: "bg-slate-100 text-slate-600 ring-slate-300",
  waived: "bg-violet-50 text-violet-700 ring-violet-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-300",
};

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONES[status] || "bg-slate-100 text-slate-600 ring-slate-300";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}
    >
      {label || humanize(status || "—")}
    </span>
  );
}

export function GradeBadge({ letter, points }) {
  if (!letter) return <span className="text-slate-400">—</span>;
  const good = ["A", "B"].some((p) => String(letter).startsWith(p));
  const mid = String(letter).startsWith("C") || String(letter).startsWith("D");
  const tone = good
    ? "bg-brand-700 text-white"
    : mid
      ? "bg-gold-500 text-brand-950"
      : "bg-red-600 text-white";
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center rounded-md px-2 py-1 text-sm font-bold ${tone}`}
    >
      {letter}
      {points != null && points !== "" ? (
        <span className="ml-1 text-[10px] font-semibold opacity-80">{points}</span>
      ) : null}
    </span>
  );
}

/* ---------------- Error boundary ---------------- */

/**
 * Contains render crashes to a readable panel instead of a blank page.
 * Used around route content in the app shell.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the real error visible for debugging; never swallow it silently.
    console.error("Page render failed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="font-display text-lg font-semibold text-red-900">This page hit a display error</p>
        <p className="mt-1 text-sm text-red-800">
          {this.state.error?.message || "Unexpected error while rendering."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }
}

/* ---------------- Feedback ---------------- */

export function Alert({ tone = "info", title, children, className = "" }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-brand-200 bg-brand-50 text-brand-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  const icons = { info: "info", success: "check", warning: "alert", error: "alert" };
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]} ${className}`} role="alert">
      <Icon name={icons[tone]} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert tone="error" title="Something went wrong">
      <p>{error?.message || "Failed to load data."}</p>
      {error?.code ? <p className="mt-1 font-mono text-xs opacity-70">code: {error.code}</p> : null}
      {onRetry ? (
        <Button size="sm" variant="secondary" className="mt-3" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Alert>
  );
}

export function EmptyState({ icon = "info", title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon name={icon} size={26} />
      </div>
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      {message ? <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------------- Tables ---------------- */

/**
 * Render one cell. Columns may declare `render(row, ctx)`; ctx carries
 * lookup data ({ lookups, label }) when the caller provides it. A throwing
 * renderer must never blank the page — fall back to the raw value.
 */
function renderCell(col, row, ctx) {
  if (!col.render) return row[col.key] ?? "—";
  try {
    const value = col.render(row, ctx);
    return value === undefined || value === null || value === "" ? "—" : value;
  } catch {
    return row[col.key] ?? "—";
  }
}

export function DataTable({ columns, rows, rowKey = (r) => r.id, empty, onRowClick, ctx }) {
  if (!rows || rows.length === 0) {
    return (
      empty || (
        <div className="px-4 py-10 text-center text-sm text-slate-400">No records found.</div>
      )
    );
  }
  return (
    <div className="nice-scroll overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer transition hover:bg-brand-50/50" : "hover:bg-slate-50/60"}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 align-middle ${col.className || ""}`}>
                  {renderCell(col, row, ctx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageCount, onPage, count, pageSize }) {
  if (pageCount <= 1 && !count) return null;
  const from = count ? (page - 1) * pageSize + 1 : 0;
  const to = count ? Math.min(count, page * pageSize) : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500">
      <span>
        {count ? `Showing ${from}–${to} of ${count}` : `Page ${page} of ${pageCount}`}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="px-2 text-xs font-semibold">
          {page} / {pageCount}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Card wrapper with header + table + optional pagination. */
export function TableCard({ title, subtitle, actions, children, footer }) {
  return (
    <Card pad={false} className="overflow-hidden">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
      {footer}
    </Card>
  );
}

/* ---------------- Forms ---------------- */

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

export function Field({ label, required, hint, error, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function TextArea({ rows = 4, ...props }) {
  return <textarea rows={rows} {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Select({ options = [], placeholder, children, ...props }) {
  return (
    <select {...props} className={`${inputCls} appearance-none pr-8 ${props.className || ""}`}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
}

export function SearchInput({ className = "", ...props }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <TextInput {...props} className="pl-9" />
    </div>
  );
}

/** Two-column form grid (stacks on mobile). */
export function FormGrid({ children, className = "" }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

/* ---------------- Modal & confirm ---------------- */

export function Modal({ open, onClose, title, subtitle, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 animate-fade-in bg-brand-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[92vh] w-full animate-pop overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-950">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  );
}


export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500">
      <Spinner size={20} className="text-brand-700" />
      {label}
    </div>
  );
}

/* ---------------- Toasts ---------------- */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "success") => {
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push],
  );

  const tones = {
    success: "border-brand-600 bg-brand-900 text-white",
    error: "border-red-500 bg-red-700 text-white",
    info: "border-slate-600 bg-slate-800 text-white",
  };
  const icons = { success: "check", error: "alert", info: "info" };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex animate-slide-in items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${tones[t.tone]}`}
              role="status"
            >
              <Icon name={icons[t.tone]} size={17} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

