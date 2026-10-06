import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { CardFilters, PlayerCompareResponse } from "../types/playerCards";
import { useApiResource } from "./useApiResource.ts";

/** Comparação entre dois jogadores (ids distintos). Sem A e B válidos (ou `enabled = false`) não busca. */
export interface CompareSide {
  id: number;
  /** Comparar este lado COMO esse arquétipo (view por arquétipo); null = sem arquétipo específico. */
  arq: number | null;
}

/**
 * Comparação entre dois lados. Jogadores distintos, ou o mesmo jogador com arquétipos diferentes (view por arquétipo).
 * Sem A e B válidos (ou `enabled = false`) não busca.
 */
export function usePlayerCompare(
  clubId: number | null,
  a: CompareSide | null,
  b: CompareSide | null,
  f: Pick<CardFilters, "from" | "to" | "gameVersion" | "archetypeId" | "positionGroup">,
  enabled = true
) {
  const { from, to, gameVersion, archetypeId = null, positionGroup = null } = f;
  const url = useMemo(
    () =>
      clubId && enabled && a !== null && b !== null && (a.id !== b.id || (a.arq ?? 0) !== (b.arq ?? 0))
        ? API_ENDPOINTS.PLAYER_COMPARE(clubId, a.id, b.id, {
            from: from || null,
            to: to || null,
            gameVersion,
            archetypeId,
            positionGroup,
            archetypeA: a.arq,
            archetypeB: b.arq,
          })
        : null,
    [clubId, enabled, a?.id, a?.arq, b?.id, b?.arq, from, to, gameVersion, archetypeId, positionGroup]
  );
  return useApiResource<PlayerCompareResponse>(url, "Não foi possível comparar os jogadores.");
}
