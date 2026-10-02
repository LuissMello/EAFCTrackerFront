import { useCallback, useEffect, useState } from "react";
import { isCanceled } from "../services/api.ts";
import { getCurrentGoalRegistration } from "../services/goalRegistrations.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { GoalRegistration } from "../types/goalRegistration.ts";

/** Registro em andamento do clube (GET /current): permite retomar depois de recarregar a página. */
export function useCurrentRegistration(clubId: number | null) {
  const [loaded, setLoaded] = useState<{ clubId: number; current: GoalRegistration | null } | null>(null);
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
        const current = await getCurrentGoalRegistration(clubId, signal);
        if (signal.aborted) return;
        setLoaded({ clubId, current });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setError(describeApiError(e, "Não foi possível verificar se há um registro em andamento.").message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [clubId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const clear = useCallback(() => setLoaded((l) => (l ? { ...l, current: null } : l)), []);
  const ready = loaded !== null && loaded.clubId === clubId;
  return { current: ready ? loaded.current : null, ready, loading, error, reload, clear };
}
