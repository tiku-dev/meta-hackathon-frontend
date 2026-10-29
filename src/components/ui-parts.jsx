import { initials } from "../lib/format";

/** Small shared display parts kept separate to avoid import cycles. */

export function Avatar({ name, size = "md" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" };
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gold-500 font-bold text-brand-950 ${sizes[size] || sizes.md}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "bg-brand-600" }) {
  const pct = max > 0 ? Math.min(100, Math.round((Number(value || 0) / Number(max)) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function KeyValue({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{children ?? "—"}</dd>
    </div>
  );
}
