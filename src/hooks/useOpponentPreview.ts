import { useCallback, useEffect, useRef, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { OpponentPreview } from "../types/goalRegistration.ts";

export type PreviewStatus = "idle" | "loading" | "done" | "error";

interface PreviewState {
  key: string;
  status: PreviewStatus;
  data: OpponentPreview | null;
  error: string | null;
}

/** Pré-estatísticas do adversário (cada bloco pode vir nulo; `warnings` explica as lacunas). */
export function useOpponentPreview(opponentClubId: number | null, name: string | null, clubId: number | null, enabled = true) {
  const key = enabled && opponentClubId !== null && clubId !== null ? `${clubId}:${opponentClubId}` : "";
  const [state, setState] = useState<PreviewState>({ key: "", status: "idle", data: null, error: null });
  const [retryKey, setRetryKey] = useState(0);
  // O nome é só um auxílio para o backend; não deve refazer a chamada
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!key || opponentClubId === null || clubId === null) return;
    const controller = new AbortController();
    const { signal } = controller;
    setState({ key, status: "loading", data: null, error: null });
    (async () => {
      try {
        const { data } = await api.get<OpponentPreview>(
          API_ENDPOINTS.GOAL_REG_OPPONENT_PREVIEW(opponentClubId, clubId, nameRef.current),
          { signal }
        );
        if (signal.aborted) return;
        setState({ key, status: "done", data: data ?? null, error: null });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setState({ key, status: "error", data: null, error: describeApiError(e, "Não foi possível carregar as estatísticas do adversário.").message });
      }
    })();
    return () => controller.abort();
  }, [key, opponentClubId, clubId, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);
  const current = state.key === key && key !== "" ? state : null;
  const status: PreviewStatus = key === "" ? "idle" : current?.status ?? "loading";
  return { status, preview: current?.data ?? null, error: current?.error ?? null, retry };
}
