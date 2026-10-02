import { useCallback, useEffect, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { RosterPlayer, RosterResponse } from "../types/goalRegistration.ts";

/** Elenco do NOSSO clube (jogadores já vistos nas partidas). Recarrega ao trocar de clube. */
export function useRoster(clubId: number | null) {
  const [loaded, setLoaded] = useState<{ clubId: number; players: RosterPlayer[] } | null>(null);
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
        const { data } = await api.get<RosterResponse>(API_ENDPOINTS.GOAL_REG_ROSTER(clubId), { signal });
        if (signal.aborted) return;
        const players = Array.isArray(data?.players) ? data.players : [];
        setLoaded({ clubId, players });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setError(describeApiError(e, "Não foi possível carregar o elenco.").message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [clubId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // Só expõe o elenco do clube atual (evita mostrar jogadores do clube anterior durante a troca)
  const players = loaded && loaded.clubId === clubId ? loaded.players : null;
  return { players, loading, error, reload };
}
