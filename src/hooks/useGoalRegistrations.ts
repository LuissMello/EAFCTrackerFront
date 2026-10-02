import { useCallback, useEffect, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { describeApiError } from "../utils/apiError.ts";
import { useRefresh } from "./useRefresh.tsx";
import type { GoalRegistration } from "../types/goalRegistration.ts";

/** Lista "Meus registros" do clube (GET /api/goal-registrations?clubId=). */
export function useGoalRegistrations(clubId: number | null) {
  const { refreshKey } = useRefresh();
  const [loaded, setLoaded] = useState<{ clubId: number; items: GoalRegistration[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (clubId === null) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data } = await api.get<GoalRegistration[]>(API_ENDPOINTS.GOAL_REGISTRATIONS_BY_CLUB(clubId), { signal });
        if (signal.aborted) return;
        setLoaded({ clubId, items: Array.isArray(data) ? data : [] });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setError(describeApiError(e, "Não foi possível carregar seus registros.").message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [clubId, reloadKey, refreshKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const items = loaded && loaded.clubId === clubId ? loaded.items : null;
  return { items, loading, error, reload };
}
