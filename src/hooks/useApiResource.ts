import { useCallback, useEffect, useRef, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { describeApiError } from "../utils/apiError.ts";
import { useRefresh } from "./useRefresh.tsx";

export interface ResourceError {
  status?: number;
  message: string;
}

export interface ApiResource<T> {
  /** Dados da URL ATUAL (nunca de uma URL anterior). */
  data: T | null;
  loading: boolean;
  error: ResourceError | null;
  /** Refaz a busca ignorando o cache. */
  reload: () => void;
}

// Cache curto em memória (somente leitura pública): evita refazer a mesma chamada ao ir e voltar
// entre noites/abas. É descartado quando o usuário clica em "Atualizar" (refreshKey muda).
const TTL_MS = 60_000; // igual ao cache do backend (60 s)
const MAX_ENTRIES = 80;
const cache = new Map<string, { at: number; refreshKey: number; data: unknown }>();

/** Descarta o cache de leituras (ex.: depois de mudar intervalo/fronteiras de sessão no admin, que reagrupa as noites). */
export function clearApiResourceCache() {
  cache.clear();
}

function cacheGet<T>(url: string, refreshKey: number): T | null {
  const hit = cache.get(url);
  if (!hit) return null;
  if (hit.refreshKey !== refreshKey || Date.now() - hit.at > TTL_MS) {
    cache.delete(url);
    return null;
  }
  return hit.data as T;
}

function cacheSet(url: string, refreshKey: number, data: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { at: Date.now(), refreshKey, data });
}

/**
 * GET abortável de um endpoint público de leitura. `url = null` desliga a busca.
 * - cancela a chamada anterior ao trocar de URL/desmontar;
 * - reage ao "Atualizar" global (useRefresh);
 * - erros normalizados em pt-BR (describeApiError), com `status` para tratar 404.
 */
export function useApiResource<T>(url: string | null, errorFallback: string): ApiResource<T> {
  const { refreshKey } = useRefresh();
  const [state, setState] = useState<{ url: string; data: T } | null>(null);
  const [errState, setErrState] = useState<{ url: string; error: ResourceError } | null>(null);
  const [nonce, setNonce] = useState(0);
  const forceRef = useRef(false);
  const fallbackRef = useRef(errorFallback);
  fallbackRef.current = errorFallback;

  useEffect(() => {
    setErrState(null);
    if (!url) {
      return;
    }
    const force = forceRef.current;
    forceRef.current = false;
    if (!force) {
      const cached = cacheGet<T>(url, refreshKey);
      if (cached) {
        setState({ url, data: cached });
        return;
      }
    }
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      try {
        const { data } = await api.get<T>(url, { signal });
        if (signal.aborted) return;
        cacheSet(url, refreshKey, data);
        setState({ url, data });
      } catch (e: unknown) {
        if (signal.aborted || isCanceled(e)) return;
        const info = describeApiError(e, fallbackRef.current);
        setErrState({ url, error: { status: info.status, message: info.message } });
      }
    })();
    return () => controller.abort();
  }, [url, refreshKey, nonce]);

  const reload = useCallback(() => {
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  const error = errState && errState.url === url ? errState.error : null;
  const data = state && state.url === url && !error ? state.data : null;
  // derivado (não é estado): evita um frame "vazio" ao trocar de URL
  const loading = url !== null && data === null && error === null;

  return { data, loading, error, reload };
}
