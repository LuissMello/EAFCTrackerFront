import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { GameNightDetail } from "../types/gameNight";
import { useApiResource } from "./useApiResource.ts";

/** Detalhe de uma noite. `sessionId = null` desliga a busca. */
export function useGameNight(clubId: number | null, sessionId: number | null) {
  const url = useMemo(
    () => (clubId && sessionId != null ? API_ENDPOINTS.GAME_NIGHT(clubId, sessionId) : null),
    [clubId, sessionId]
  );
  return useApiResource<GameNightDetail>(url, "Não foi possível carregar esta noite.");
}
