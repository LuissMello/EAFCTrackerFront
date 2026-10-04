import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { GameNightsResponse } from "../types/gameNight";
import { useApiResource } from "./useApiResource.ts";

/** Lista leve de noites do clube (ascendente) — usada na navegação « » e na faixa de datas. */
export function useGameNights(clubId: number | null) {
  const url = useMemo(() => (clubId ? API_ENDPOINTS.GAME_NIGHTS(clubId) : null), [clubId]);
  return useApiResource<GameNightsResponse>(url, "Não foi possível carregar as noites de jogo.");
}
