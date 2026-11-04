import { useMemo, useState } from "react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SearchInput,
  Select,
  TableCard,
  useToast,
} from "./ui";
import { ResourceFormModal, optionLabel } from "./crud-form";
import { api, qs } from "../lib/api";
import { usePagedList } from "../lib/hooks";
import { labelById, useLookup } from "../lib/lookups";

/**
 * Config-driven CRUD page for DRF viewsets.
 *
 * resource = {
 *   title, subtitle, path (trailing slash), singular, canWrite,
 *   columns: [{ key, header, render(row, ctx), className }],
 *   fields:  [{ name, label, type, required, options | lookup,
 *               showWhen(form), span, placeholder, hint, min, step }],
 *   filters: [{ name, label, lookup | options }],
 *   actions(row, ctx): extra action buttons,
 *   transformSubmit(form, record): payload cleanup,
 *   onSaved(): side effects (e.g. invalidate lookups),
 * }
 */
export function ResourcePage({ resource }) {
  const toast = useToast();
  const {
    title, subtitle, path, singular = "Record", canWrite = true,
    columns = [], filters = [], actions, emptyMessage,
  } = resource;

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [editing, setEditing] = useState(null); // null | {} (create) | row
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const query = qs({ search: search || undefined, ...filterValues });
  const list = usePagedList(`${path}${query}`, { deps: [query] });

  const units = useLookup("units");
  const programs = useLookup("programs");
  const levels = useLookup("levels");
  const years = useLookup("years");
  const semesters = useLookup("semesters");
  const courses = useLookup("courses");
  const lecturers = useLookup("lecturers");
  const students = useLookup("students");
  const policies = useLookup("gradingPolicies");
  const lookupRows = { units, programs, levels, years, semesters, courses, lecturers, students, policies };

  const ctx = useMemo(
    () => ({ lookups: lookupRows, label: labelById }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [units, programs, levels, years, semesters, courses, lecturers, students, policies],
  );

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`${path}${deleting.id}/`, { method: "DELETE" });
      toast.success(`${singular} deleted.`);
      setDeleting(null);
      resource.onSaved?.();
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const tableColumns = [
    ...columns,
    ...(canWrite || actions
      ? [
          {
            key: "__actions",
            header: "",
            className: "w-px whitespace-nowrap text-right",
            render: (row) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {actions?.(row, { reload: list.reload, toast, ...ctx })}
                {canWrite && (
                  <>
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing({ ...row })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="dangerGhost" icon="trash" onClick={() => setDeleting(row)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <TableCard
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <FilterSelect
                key={f.name}
                filter={f}
                rows={f.lookup ? lookupRows[f.lookup] : null}
                value={filterValues[f.name] || ""}
                lookups={lookupRows}
                onChange={(v) => setFilterValues((s) => ({ ...s, [f.name]: v }))}
              />
            ))}
            <SearchInput
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            {canWrite && (
              <Button icon="plus" onClick={() => setEditing({})}>
                New {singular.toLowerCase()}
              </Button>
            )}
          </div>
        }
        footer={
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            onPage={list.setPage}
            count={list.count}
            pageSize={list.pageSize}
          />
        }
      >
        {list.loading && !list.rows.length ? (
          <LoadingState />
        ) : list.error ? (
          <div className="p-5">
            <ErrorState error={list.error} onRetry={list.reload} />
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            rows={list.rows}
            ctx={ctx}
            empty={
              <EmptyState
                icon="list"
                title={`No ${title.toLowerCase()} yet`}
                message={emptyMessage || "Create the first record to get started."}
                action={
                  canWrite ? (
                    <Button icon="plus" onClick={() => setEditing({})}>
                      New {singular.toLowerCase()}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </TableCard>

      <ResourceFormModal
        resource={resource}
        record={editing}
        lookups={lookupRows}
        onClose={() => setEditing(null)}
        onSaved={(data, isEdit) => {
          setEditing(null);
          resource.onSaved?.(data, isEdit);
          list.reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={busy}
        danger
        title={`Delete ${singular.toLowerCase()}?`}
        message="This permanently removes the record. The backend may refuse if other records depend on it."
        confirmLabel="Delete"
      />
    </div>
  );
}

function FilterSelect({ filter, rows, value, onChange, lookups }) {
  const options =
    filter.options || (rows || []).map((r) => ({ value: r.id, label: optionLabel(filter, r, lookups) }));
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={filter.label}
      options={options}
      className="w-44"
      aria-label={filter.label}
    />
  );
}

