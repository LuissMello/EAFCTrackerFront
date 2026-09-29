import { useMemo } from "react";
import { useClub } from "./useClub.tsx";

/**
 * IDs de clube efetivos: a seleção múltipla, ou (se vazia) o clube único legado.
 * A referência do array só muda quando a seleção ou o id do clube mudam.
 */
export function useClubIds(): number[] {
  const { club, selectedClubIds } = useClub();
  const legacyClubId = club?.clubId;
  return useMemo(
    () => (selectedClubIds.length > 0 ? selectedClubIds : legacyClubId ? [legacyClubId] : []),
    [selectedClubIds, legacyClubId]
  );
}
