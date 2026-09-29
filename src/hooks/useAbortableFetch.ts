import { useEffect, useState } from "react";
import type { DependencyList } from "react";
import { isCanceled } from "../services/api.ts";
import { useRefresh } from "./useRefresh.tsx";

type Options = {
  /** Quando false a busca não roda (ex.: nenhum clube selecionado). Padrão: true. */
  enabled?: boolean;
  /** Mensagem usada quando o erro não traz `message`. */
  errorMessage: string;
};

/**
 * Executa `load(signal)` no mount e sempre que `deps` mudarem, abortando a chamada anterior
 * (e ao desmontar). Gerencia `loading`/`error`; o resultado é gravado pelo próprio `load`.
 *
 * `load` deve checar `signal.aborted` depois de cada `await` antes de gravar estado — o hook
 * já ignora erros de cancelamento e não mexe em `loading`/`error` de uma execução abortada.
 */
export function useAbortableFetch(
  load: (signal: AbortSignal) => Promise<void>,
  deps: DependencyList,
  { enabled = true, errorMessage }: Options
): { loading: boolean; error: string | null } {
  const { refreshKey } = useRefresh();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load(signal);
      } catch (e: any) {
        if (signal.aborted || isCanceled(e)) return;
        setError(e?.message ?? errorMessage);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, refreshKey, ...deps]);

  return { loading, error };
}
