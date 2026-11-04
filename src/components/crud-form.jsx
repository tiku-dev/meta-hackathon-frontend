import { useState } from "react";
import {
  Button,
  Field,
  FormGrid,
  Modal,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "./ui";
import { api } from "../lib/api";
import { toLocalInput } from "../lib/format";

export function optionLabel(field, row, lookups) {
  if (field?.optionLabel) return field.optionLabel(row);
  const progName =
    row.program_name ||
    (row.program && lookups?.programs ? lookups.programs.find((p) => String(p.id) === String(row.program))?.name : null);
  return (
    row.full_name ||
    (row.course_code ? `${row.course_code} — ${row.course_title || ""}`.trim() : null) ||
    (progName && row.label ? `${progName} — ${row.label}` : null) ||
    row.name ||
    row.label ||
    row.code ||
    row.title ||
    row.matricule ||
    `#${row.id}`
  );
}

function fieldOptions(field, lookups, form) {
  if (field.options) return field.options;
  if (field.lookup) {
    let rows = lookups[field.lookup] || [];
    const isLevelField =
      field.lookup === "levels" || field.name === "current_level" || field.name === "level";
    if (isLevelField && form?.program) {
      rows = rows.filter((r) => String(r.program) === String(form.program));
      return rows.map((r) => ({
        value: r.id,
        label: r.label,
      }));
    }
    return rows.map((r) => ({
      value: r.id,
      label: optionLabel(field, r, lookups),
    }));
  }
  return [];
}


/**
 * Create/edit modal generated from a resource `fields` config.
 * `record === null` → closed; `{}` → create; row with `id` → PATCH edit.
 */
export function ResourceFormModal({ resource, record, lookups, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // (Re)initialise whenever a different record is opened.
  const [lastRecord, setLastRecord] = useState(undefined);
  if (record !== lastRecord) {
    setLastRecord(record);
    if (record) {
      const initial = {};
      resource.fields.forEach((f) => {
        let v = record[f.name];
        if (f.type === "datetime" && v) v = toLocalInput(v);
        if (f.type === "checkbox") v = Boolean(v);
        initial[f.name] = v ?? "";
      });
      setForm(initial);
      setError("");
      setFieldErrors({});
    } else {
      setForm(null);
    }
  }

  if (!record || !form) return null;
  const isEdit = Boolean(record.id);
  const set = (name, value) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setForm((s) => {
      const next = { ...s, [name]: value };
      if (name === "program") {
        if (next.current_level) {
          const lvl = (lookups?.levels || []).find((l) => String(l.id) === String(next.current_level));
          if (lvl && String(lvl.program) !== String(value)) {
            next.current_level = "";
          }
        }
        if (next.level) {
          const lvl = (lookups?.levels || []).find((l) => String(l.id) === String(next.level));
          if (lvl && String(lvl.program) !== String(value)) {
            next.level = "";
          }
        }
      }
      return next;
    });
  };

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      let payload = { ...form };
      resource.fields.forEach((f) => {
        if (f.type === "number") {
          payload[f.name] =
            payload[f.name] === "" || payload[f.name] === null ? null : Number(payload[f.name]);
        }
        if (f.type === "datetime") {
          payload[f.name] = payload[f.name] ? new Date(payload[f.name]).toISOString() : null;
        }
        if ((f.type === "select" || f.type === "lookup") && payload[f.name] === "") {
          payload[f.name] = null;
        }
      });
      if (resource.transformSubmit) payload = resource.transformSubmit(payload, record);
      let result = null;
      if (isEdit) {
        result = await api(`${resource.path}${record.id}/`, { method: "PATCH", body: payload });
        toast.success(`${resource.singular} updated.`);
      } else {
        result = await api(resource.path, { method: "POST", body: payload });
        toast.success(`${resource.singular} created.`);
      }
      onSaved?.(result, isEdit);
    } catch (err) {
      setError(err.message || "Failed to save.");
      if (err.details && typeof err.details === "object" && !Array.isArray(err.details)) {
        const fe = {};
        for (const [key, val] of Object.entries(err.details)) {
          if (Array.isArray(val) && val.length > 0) {
            fe[key] = typeof val[0] === "string" ? val[0] : String(val[0]);
          } else if (typeof val === "string") {
            fe[key] = val;
          }
        }
        setFieldErrors(fe);
      }
    } finally {
      setSaving(false);
    }
  }

  const inputType = (f) =>
    f.type === "number"
      ? "number"
      : f.type === "datetime"
        ? "datetime-local"
        : f.type === "date"
          ? "date"
          : f.type || "text";

  return (
    <Modal
      open
      onClose={onClose}
      wide={resource.fields.length > 6}
      title={`${isEdit ? "Edit" : "New"} ${resource.singular.toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="resource-form" loading={saving}>
            {isEdit ? "Save changes" : `Create ${resource.singular.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <FormGrid>
          {resource.fields
            .filter((f) => !f.showWhen || f.showWhen(form))
            .map((f) => {
              const errCls = fieldErrors[f.name]
                ? "!border-red-400 focus:!border-red-500 focus:!ring-red-100"
                : "";
              return (
                <Field
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  hint={f.hint}
                  error={fieldErrors[f.name]}
                  className={f.span === 2 ? "sm:col-span-2" : ""}
                >
                  {f.type === "textarea" ? (
                    <TextArea
                      value={form[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      required={f.required}
                      rows={f.rows || 3}
                      className={errCls}
                    />
                  ) : f.type === "checkbox" ? (
                    <span className="flex h-[38px] items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brand-700"
                        checked={Boolean(form[f.name])}
                        onChange={(e) => set(f.name, e.target.checked)}
                      />
                      {f.checkboxLabel || "Enabled"}
                    </span>
                  ) : f.type === "select" || f.type === "lookup" ? (
                    <Select
                      value={form[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      options={fieldOptions(f, lookups, form)}
                      placeholder={f.placeholder || "Select…"}
                      required={f.required}
                      className={errCls}
                    />
                  ) : (
                    <TextInput
                      type={inputType(f)}
                      value={form[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      required={f.required}
                      min={f.min}
                      step={f.step}
                      className={errCls}
                    />
                  )}
                </Field>
              );
            })}
        </FormGrid>
      </form>
    </Modal>
  );
}
