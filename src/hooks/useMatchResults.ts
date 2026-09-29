import { useCallback, useEffect, useRef, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { MatchResultDto, MatchTypeFilter, PagedResult, RedCardFilter, SortKey } from "../types/match.ts";
import { coercePaged } from "../utils/paged.ts";
import { useRefresh } from "./useRefresh.tsx";

type Params = {
  selectedClubIds: number[];
  matchType: MatchTypeFilter;
  opponentCount: number | null;
  /** Filtro de versão do jogo (26 = FC26); null = todas */
  gameVersion: number | null;
  search: string;
  redFilter: RedCardFilter;
  opponentDivision: number | null;
  sort: SortKey;
  page: number;
  pageSize: number;
  /**
   * Chave da seleção/filtros que invalidam a lista atual (clubes|tipo|contagem|versão). Quando muda, a lista antiga é
   * descartada; paginar/atualizar mantém a lista atual enquanto carrega.
   */
  filterKey: string;
};

/**
 * Carrega os resultados (server-side paginado) da Home e expõe o estado da lista + `refresh`.
 * Refaz a busca quando clubes, tipo, contagem de adversários, versão, página, tamanho da página, `reloadKey`
 * (local) ou o `refreshKey` global (botão "Atualizar"/modo ao vivo no cabeçalho) mudam.
 */
export function useMatchResults({ selectedClubIds, matchType, opponentCount, gameVersion, search, redFilter, opponentDivision, sort, page, pageSize, filterKey }: Params) {
  const { refreshKey } = useRefresh();
  const [results, setResults] = useState<MatchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Incrementado por "Tentar novamente" (o "Atualizar" do cabeçalho usa o refreshKey global) */
  const [reloadKey, setReloadKey] = useState(0);

  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [hasPrev, setHasPrev] = useState<boolean>(false);
  const [isServerPaged, setIsServerPaged] = useState<boolean>(false);

  // Modo multi-clubes usa "mostrar mais"
  const [visible, setVisible] = useState(30);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const loadedFilterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    if (selectedClubIds.length === 0) {
      loadedFilterKeyRef.current = null;
      setResults([]);
      setTotalCount(0);
      setTotalPages(0);
      setHasNext(false);
      setHasPrev(false);
      setIsServerPaged(false);
      setError(null);
      setLoading(false);
      return;
    }

    // Trocou de clube/tipo/contagem → não mostrar a lista antiga; paginar/atualizar mantém a lista atual
    if (loadedFilterKeyRef.current !== filterKey) setResults([]);

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const baseParams: Record<string, string | number> = {};
        if (matchType !== "All") baseParams.matchType = matchType;
        if (opponentCount) baseParams.opponentCount = opponentCount;
        if (gameVersion !== null) baseParams.gameVersion = gameVersion;
        if (search.trim()) baseParams.search = search.trim();
        if (redFilter !== "all") baseParams.redFilter = redFilter;
        if (opponentDivision !== null) baseParams.opponentDivision = opponentDivision;
        if (sort !== "recent") baseParams.sort = sort;

        let data: PagedResult<MatchResultDto> | MatchResultDto[];

        if (selectedClubIds.length === 1) {
          // Paginação no servidor (o backend só lê `page` e `pageSize`)
          const res = await api.get<PagedResult<MatchResultDto> | MatchResultDto[]>(
            API_ENDPOINTS.CLUB_MATCHES_RESULTS(selectedClubIds[0]),
            { params: { ...baseParams, page, pageSize }, signal }
          );
          data = res.data;
        } else {
          // Múltiplos clubes → uma única chamada server-side paginada
          const res = await api.get<PagedResult<MatchResultDto>>(API_ENDPOINTS.CLUB_MATCHES_RESULTS_MULTI, {
            params: { ...baseParams, clubIds: selectedClubIds, page, pageSize },
            paramsSerializer: (p) => {
              const sp = new URLSearchParams();
              for (const [key, val] of Object.entries(p)) {
                if (Array.isArray(val)) {
                  (val as unknown[]).forEach((v) => sp.append(key, String(v)));
                } else if (val !== undefined && val !== null) {
                  sp.append(key, String(val));
                }
              }
              return sp.toString();
            },
            signal,
          });
          data = res.data;
        }

        if (signal.aborted) return;

        const norm = coercePaged<MatchResultDto>(data);

        loadedFilterKeyRef.current = filterKey;
        setIsServerPaged(norm.isPaged);
        setResults(norm.items);
        setTotalCount(norm.totalCount);
        setTotalPages(norm.totalPages);
        setHasNext(norm.hasNext);
        setHasPrev(norm.hasPrevious);

        // se vier array puro
        if (!norm.isPaged) {
          setVisible(Math.max(30, Math.min(norm.items.length, pageSize)));
        }
      } catch (err: any) {
        if (signal.aborted || isCanceled(err)) return;
        setError(err?.message ?? "Erro ao carregar resultados");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
    // filterKey deriva de selectedClubIds/matchType/opponentCount (já nas deps); as deps do hook são intencionais
  }, [selectedClubIds, matchType, opponentCount, gameVersion, search, redFilter, opponentDivision, sort, page, pageSize, reloadKey, refreshKey]);

  return {
    results,
    loading,
    error,
    refresh,
    totalCount,
    totalPages,
    hasNext,
    hasPrev,
    isServerPaged,
    visible,
    setVisible,
  };
}
