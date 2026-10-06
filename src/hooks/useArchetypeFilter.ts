import { useCallback, useMemo } from "react";
import { useUrlParams } from "./useUrlState.ts";
import type { ArchetypeGroup } from "../types/archetypes.ts";
import { parseArchetypeParam, parsePositionParam } from "../utils/archetypeFilters.ts";

export interface ArchetypeFilterValue {
  positionGroup: ArchetypeGroup | null;
  archetypeId: number | null;
}

/** Filtro Posição → Arquétipo guardado na URL: `?pos=GOLEIRO|DEFESA|MEIO|ATAQUE&arq=<id>` (ausente = Todas/Todos). */
export function useArchetypeFilter(): readonly [ArchetypeFilterValue, (next: ArchetypeFilterValue) => void] {
  const [params, update] = useUrlParams();
  const pos = params.get("pos");
  const arq = params.get("arq");
  const value = useMemo<ArchetypeFilterValue>(
    () => ({ positionGroup: parsePositionParam(pos), archetypeId: parseArchetypeParam(arq ?? "") }),
    [pos, arq]
  );
  const set = useCallback(
    (next: ArchetypeFilterValue) => update({ pos: next.positionGroup, arq: next.archetypeId }),
    [update]
  );
  return [value, set] as const;
}
