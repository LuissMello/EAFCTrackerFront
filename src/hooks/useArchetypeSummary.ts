import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { ArchetypeSummary } from "../types/archetypes.ts";
import type { LabFilters } from "../types/lab";
import type { ArchetypeFilterValue } from "./useArchetypeFilter.ts";
import { useApiResource } from "./useApiResource.ts";

/**
 * Resumo por arquétipo do clube (GET /api/clubs/{id}/archetypes/summary).
 * Respeita período e versão; `enabled = false` (aba inativa) não dispara a busca.
 */
export function useArchetypeSummary(
  clubId: number | null,
  f: Pick<LabFilters, "from" | "to" | "gameVersion">,
  enabled = true,
  archetypeFilter: ArchetypeFilterValue = { positionGroup: null, archetypeId: null }
) {
  const { from, to, gameVersion } = f;
  const { positionGroup, archetypeId } = archetypeFilter;
  const url = useMemo(
    () =>
      clubId && enabled
        ? API_ENDPOINTS.CLUB_ARCHETYPES_SUMMARY(clubId, { from: from || null, to: to || null, gameVersion, positionGroup, archetypeId })
        : null,
    [clubId, enabled, from, to, gameVersion, positionGroup, archetypeId]
  );
  return useApiResource<ArchetypeSummary>(url, "Não foi possível carregar o resumo por arquétipo.");
}
