import { useMemo } from "react";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { WrappedData } from "../types/wrapped";
import { useApiResource } from "./useApiResource.ts";

/** Retrospectiva do clube para uma versão do jogo (null = todas). */
export function useWrapped(clubId: number | null, gameVersion: number | null, enabled = true) {
  const url = useMemo(
    () => (clubId && enabled ? API_ENDPOINTS.WRAPPED(clubId, gameVersion) : null),
    [clubId, gameVersion, enabled]
  );
  return useApiResource<WrappedData>(url, "Não foi possível carregar a retrospectiva.");
}
