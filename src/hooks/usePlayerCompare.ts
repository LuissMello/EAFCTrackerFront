import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { CardFilters, PlayerCompareResponse } from "../types/playerCards";
import { useApiResource } from "./useApiResource.ts";

/** Comparação entre dois jogadores (ids distintos). Sem A e B válidos (ou `enabled = false`) não busca. */
export function usePlayerCompare(
  clubId: number | null,
  a: number | null,
  b: number | null,
  f: Pick<CardFilters, "from" | "to" | "gameVersion">,
  enabled = true
) {
  const { from, to, gameVersion } = f;
  const url = useMemo(
    () =>
      clubId && enabled && a !== null && b !== null && a !== b
        ? API_ENDPOINTS.PLAYER_COMPARE(clubId, a, b, { from: from || null, to: to || null, gameVersion })
        : null,
    [clubId, enabled, a, b, from, to, gameVersion]
  );
  return useApiResource<PlayerCompareResponse>(url, "Não foi possível comparar os jogadores.");
}
