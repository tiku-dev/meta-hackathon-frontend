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

export function optionLabel(field, row) {
  if (field?.optionLabel) return field.optionLabel(row);
  return (
    row.full_name ||
    (row.course_code ? `${row.course_code} — ${row.course_title || ""}`.trim() : null) ||
    row.name ||
    row.label ||
    row.code ||
    row.title ||
    row.matricule ||
    `#${row.id}`
  );
}

function fieldOptions(field, lookups) {
  if (field.options) return field.options;
  if (field.lookup) {
    return (lookups[field.lookup] || []).map((r) => ({
      value: r.id,
      label: optionLabel(field, r),
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
    } else {
      setForm(null);
    }
  }

  if (!record || !form) return null;
  const isEdit = Boolean(record.id);
  const set = (name, value) => setForm((s) => ({ ...s, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
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
      if (isEdit) {
        await api(`${resource.path}${record.id}/`, { method: "PATCH", body: payload });
        toast.success(`${resource.singular} updated.`);
      } else {
        await api(resource.path, { method: "POST", body: payload });
        toast.success(`${resource.singular} created.`);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
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
            .map((f) => (
              <Field
                key={f.name}
                label={f.label}
                required={f.required}
                hint={f.hint}
                className={f.span === 2 ? "sm:col-span-2" : ""}
              >
                {f.type === "textarea" ? (
                  <TextArea
                    value={form[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    rows={f.rows || 3}
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
                    options={fieldOptions(f, lookups)}
                    placeholder={f.placeholder || "Select…"}
                    required={f.required}
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
                  />
                )}
              </Field>
            ))}
        </FormGrid>
      </form>
    </Modal>
  );
}

