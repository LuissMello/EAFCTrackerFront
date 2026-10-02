import { useCallback, useEffect, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { OpponentResult, OpponentSearchResponse } from "../types/goalRegistration.ts";

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_RESULTS = 15;

export type SearchStatus = "idle" | "loading" | "done" | "error";

interface SearchState {
  /** Termo ao qual `results` pertence (evita exibir resultado velho para o texto novo). */
  term: string;
  status: SearchStatus;
  results: OpponentResult[];
  eaAvailable: boolean;
  eaTruncated: boolean;
  error: string | null;
}

const IDLE: SearchState = { term: "", status: "idle", results: [], eaAvailable: true, eaTruncated: false, error: null };

/**
 * Busca de adversário: espera 300 ms sem digitar, exige >= 2 caracteres, cancela a requisição anterior
 * (AbortController) e limita o resultado a 15 cards.
 */
export function useOpponentSearch(query: string, clubId: number | null, enabled = true) {
  const term = query.trim();
  const [state, setState] = useState<SearchState>(IDLE);
  const [retryKey, setRetryKey] = useState(0);
  const active = enabled && clubId !== null && term.length >= SEARCH_MIN_CHARS;

  useEffect(() => {
    if (!active || clubId === null) {
      setState((s) => (s === IDLE ? s : IDLE));
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, term, status: "loading", error: null }));
      try {
        const { data } = await api.get<OpponentSearchResponse>(
          API_ENDPOINTS.GOAL_REG_OPPONENT_SEARCH(term, clubId, SEARCH_MAX_RESULTS),
          { signal }
        );
        if (signal.aborted) return;
        const list = Array.isArray(data?.results) ? data.results.slice(0, SEARCH_MAX_RESULTS) : [];
        setState({
          term,
          status: "done",
          results: list,
          eaAvailable: data?.eaAvailable !== false,
          eaTruncated: data?.eaTruncated === true,
          error: null,
        });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setState({ ...IDLE, term, status: "error", error: describeApiError(e, "Não foi possível buscar adversários.").message });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, term, clubId, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);
  const tooShort = enabled && term.length > 0 && term.length < SEARCH_MIN_CHARS;
  const fresh = active && state.term === term;
  // Enquanto o debounce não terminou (ou o resultado é de um termo anterior), conta como "carregando"
  const status: SearchStatus = !active ? "idle" : fresh ? state.status : "loading";
  return {
    status,
    results: fresh ? state.results : [],
    eaAvailable: state.eaAvailable,
    eaTruncated: fresh ? state.eaTruncated : false,
    error: fresh ? state.error : null,
    tooShort,
    term,
    retry,
  };
}
