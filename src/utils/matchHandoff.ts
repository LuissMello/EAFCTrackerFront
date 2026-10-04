import type { MatchResultDto } from "../types/match.ts";

/**
 * Passa os dados da partida (data, divisão, versão, estádio) da lista para a página de detalhes sem nova
 * requisição. Não usa o `state` do router porque o ClubProvider reescreve a URL (replace) e descarta o state.
 * Vive só em memória: ao recarregar a página de detalhes, o placar aparece sem data.
 */
const cache = new Map<number, MatchResultDto>();

export function rememberMatch(m: MatchResultDto): void {
    cache.set(Number(m.matchId), m);
    // evita crescer sem limite em sessões longas
    if (cache.size > 200) {
        const first = cache.keys().next().value;
        if (first !== undefined) cache.delete(first);
    }
}

export function recallMatch(matchId: string | number | undefined): MatchResultDto | null {
    if (matchId === undefined) return null;
    return cache.get(Number(matchId)) ?? null;
}
