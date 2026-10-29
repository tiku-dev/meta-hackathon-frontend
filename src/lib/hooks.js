import { useCallback, useEffect, useRef, useState } from "react";
import { api, asList } from "./api";

/**
 * Fetch JSON on mount / when `deps` change.
 * Returns { data, loading, error, reload, setData }.
 */
export function useApi(path, options = {}) {
  const { enabled = true } = options;
  // Callers pass a fresh deps array identity each render; keying on its
  // serialised contents keeps the load callback stable but correct.
  const depsKey = JSON.stringify(options.deps || []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !path) {
      setLoading(false);
      return null;
    }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api(path);
      if (seq.current === mine) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (seq.current === mine) {
        setError(err);
        setLoading(false);
      }
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, depsKey]);

  useEffect(() => {
    // Fetch on mount / when the request identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

/**
 * Paginated list helper for DRF endpoints.
 * Returns { rows, count, page, setPage, pageSize, loading, error, reload }.
 * Pass a full path (with any query string); `page`/`page_size` are appended.
 */
export function usePagedList(path, { pageSize = 25, deps = [] } = {}) {
  const [page, setPageState] = useState(1);
  const [queryPart, setQueryPart] = useState(null);
  const separator = path && path.includes("?") ? "&" : "?";
  const setPage = useCallback((next) => {
    const basePath = String(path || "").split("?")[0];
    setQueryPart(basePath);
    setPageState(next);
  }, [path]);
  // Reset to the first page whenever the underlying query (path) changes.
  const effectivePage = queryPart === String(path || "").split("?")[0] ? page : 1;
  const { data, loading, error, reload } = useApi(
    path ? `${path}${separator}page=${effectivePage}&page_size=${pageSize}` : null,
    { deps: [effectivePage, pageSize, ...deps] },
  );
  const rows = asList(data);
  const count = data && !Array.isArray(data) ? data.count ?? rows.length : rows.length;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  return { rows, count, page: effectivePage, setPage, pageCount, pageSize, loading, error, reload, raw: data };
}

/** Simple boolean toggle: const [open, toggle] = useToggle() */
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}
