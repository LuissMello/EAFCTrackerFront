import { useCallback, useEffect, useMemo, useRef } from "react";
import { useUrlParams } from "./useUrlState.ts";
import { defaultRange, isYmd, type DateRange } from "../utils/dateRanges.ts";

/**
 * Período (dateFrom/dateTo) na URL. Diferente dos demais filtros, o período é escrito na URL
 * já na primeira renderização (mesmo quando é o padrão): padrões relativos como "últimos 30 dias"
 * mudam de significado com o tempo, então um link compartilhado precisa carregar as datas exatas.
 * Usa replace (sem poluir o histórico do navegador).
 */
export function useUrlDateRange(
    fallback?: () => DateRange,
    keys: { from: string; to: string } = { from: "dateFrom", to: "dateTo" }
): readonly [DateRange, (range: DateRange) => void] {
    const [params, update] = useUrlParams();

    // O padrão é calculado uma única vez por montagem (não muda se a tela ficar aberta após a meia-noite)
    const fallbackRef = useRef<DateRange | null>(null);
    if (fallbackRef.current === null) fallbackRef.current = fallback ? fallback() : defaultRange();
    const fallbackRange = fallbackRef.current;

    const rawFrom = params.get(keys.from);
    const rawTo = params.get(keys.to);

    const range = useMemo<DateRange>(() => {
        const from = isYmd(rawFrom) ? rawFrom : fallbackRange.from;
        const to = isYmd(rawTo) ? rawTo : fallbackRange.to;
        return from <= to ? { from, to } : { from: to, to: from };
    }, [rawFrom, rawTo, fallbackRange]);

    // Escreve o período efetivo na URL quando faltar/estiver inválido
    useEffect(() => {
        if (rawFrom !== range.from || rawTo !== range.to) {
            update({ [keys.from]: range.from, [keys.to]: range.to });
        }
    }, [rawFrom, rawTo, range.from, range.to, update, keys.from, keys.to]);

    const setRange = useCallback(
        (next: DateRange) => update({ [keys.from]: next.from, [keys.to]: next.to }),
        [update, keys.from, keys.to]
    );

    return [range, setRange] as const;
}
