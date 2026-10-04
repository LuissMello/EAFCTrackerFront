import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { CardFilters, PlayerCardsResponse } from "../types/playerCards";
import { useApiResource } from "./useApiResource.ts";

/** Cartas dos jogadores do clube. `enabled = false` (ex.: versões ainda carregando) não dispara a busca. */
export function usePlayerCards(clubId: number | null, f: CardFilters, enabled = true) {
  const { from, to, gameVersion, minMatches } = f;
  const url = useMemo(
    () =>
      clubId && enabled
        ? API_ENDPOINTS.PLAYER_CARDS(clubId, { from: from || null, to: to || null, gameVersion, minMatches })
        : null,
    [clubId, enabled, from, to, gameVersion, minMatches]
  );
  return useApiResource<PlayerCardsResponse>(url, "Não foi possível carregar as cartas dos jogadores.");
}
