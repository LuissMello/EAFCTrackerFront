import { useCallback, useMemo, useState } from "react";
import { useClub } from "./useClub.tsx";

export interface AnalyticsClubOption {
  clubId: number;
  name: string;
  crestAssetId: string | null;
}

/**
 * Clube "ativo" das páginas de análise (Noite de jogo, Laboratório, Retrospectiva).
 * Por padrão é o primeiro clube selecionado no cabeçalho; quando há vários selecionados,
 * a página oferece um select próprio (escolha local, não mexe na seleção global).
 */
export function useAnalyticsClub() {
  const { selectedClubs, club, allClubs, clubsLoading } = useClub();
  const [pickedId, setPickedId] = useState<number | null>(null);

  const options = useMemo<AnalyticsClubOption[]>(() => {
    const base = selectedClubs.length > 0 ? selectedClubs : club ? [club] : [];
    return base.map((c) => {
      const known = allClubs.find((x) => x.clubId === c.clubId);
      return {
        clubId: c.clubId,
        name: c.clubName ?? known?.name ?? `Clube ${c.clubId}`,
        crestAssetId: c.crestAssetId ?? known?.crestAssetId ?? null,
      };
    });
  }, [selectedClubs, club, allClubs]);

  const active = useMemo(
    () => options.find((o) => o.clubId === pickedId) ?? options[0] ?? null,
    [options, pickedId]
  );

  const pick = useCallback((id: number) => setPickedId(id), []);

  return { options, active, pick, clubsLoading };
}
