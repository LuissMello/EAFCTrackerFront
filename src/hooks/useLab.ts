import { useMemo } from "react";
import { API_ENDPOINTS, type LabQuery } from "../config/urls.ts";
import type { DuosResponse, LabContextResponse, LabFilters, PlayerImpactResponse } from "../types/lab";
import { useApiResource } from "./useApiResource.ts";

function toQuery(f: LabFilters, withMin: boolean): LabQuery {
  return {
    from: f.from || null,
    to: f.to || null,
    gameVersion: f.gameVersion,
    minMatches: withMin ? f.minMatches : null,
  };
}

/** Impacto "com e sem" de cada jogador. `enabled = false` (aba inativa) não dispara a busca. */
export function useLabPlayerImpact(clubId: number | null, f: LabFilters, enabled = true) {
  const { from, to, gameVersion, minMatches } = f;
  const url = useMemo(
    () => (clubId && enabled ? API_ENDPOINTS.LAB_PLAYER_IMPACT(clubId, toQuery({ from, to, gameVersion, minMatches }, true)) : null),
    [clubId, enabled, from, to, gameVersion, minMatches]
  );
  return useApiResource<PlayerImpactResponse>(url, "Não foi possível carregar o impacto dos jogadores.");
}

/** Contexto (dia, hora, posição na noite, formação, força do adversário). */
export function useLabContext(clubId: number | null, f: LabFilters, enabled = true) {
  const { from, to, gameVersion, minMatches } = f;
  const url = useMemo(
    () => (clubId && enabled ? API_ENDPOINTS.LAB_CONTEXT(clubId, toQuery({ from, to, gameVersion, minMatches }, false)) : null),
    [clubId, enabled, from, to, gameVersion, minMatches]
  );
  return useApiResource<LabContextResponse>(url, "Não foi possível carregar o contexto das partidas.");
}

/** Melhores/piores duplas. */
export function useLabDuos(clubId: number | null, f: LabFilters, enabled = true) {
  const { from, to, gameVersion, minMatches } = f;
  const url = useMemo(
    () => (clubId && enabled ? API_ENDPOINTS.LAB_DUOS(clubId, toQuery({ from, to, gameVersion, minMatches }, true)) : null),
    [clubId, enabled, from, to, gameVersion, minMatches]
  );
  return useApiResource<DuosResponse>(url, "Não foi possível carregar as duplas.");
}
