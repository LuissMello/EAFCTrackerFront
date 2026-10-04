/** Títulos de página por rota (document.title e leitores de tela). */
export const APP_NAME = "EAFC Tracker";

const ROUTE_TITLES: { pattern: RegExp; title: string }[] = [
    { pattern: /^\/$/, title: "Partidas" },
    { pattern: /^\/match\/[^/]+\/goals$/, title: "Gols da partida" },
    { pattern: /^\/match\/[^/]+$/, title: "Partida" },
    { pattern: /^\/goal-analytics$/, title: "Gols" },
    { pattern: /^\/statistics\/player\/[^/]+\/[^/]+$/, title: "Jogador na partida" },
    { pattern: /^\/stats$/, title: "Estatísticas" },
    { pattern: /^\/calendar$/, title: "Calendário" },
    { pattern: /^\/trends$/, title: "Tendências e sequências" },
    { pattern: /^\/attributes$/, title: "Atributos" },
    { pattern: /^\/statisticsbydate$/, title: "Stats Período" },
    { pattern: /^\/singlestatisticsbydate$/, title: "Stats Individuais" },
    { pattern: /^\/records$/, title: "Recordes" },
    { pattern: /^\/player\/[^/]+$/, title: "Jogador" },
    { pattern: /^\/opponents$/, title: "Adversários" },
    { pattern: /^\/overall-evolution$/, title: "Evolução do overall" },
    { pattern: /^\/registrar-gols$/, title: "Registrar gols" },
    { pattern: /^\/noite-de-jogo$/, title: "Noite de jogo" },
    { pattern: /^\/laboratorio$/, title: "Laboratório" },
    { pattern: /^\/retrospectiva$/, title: "Retrospectiva" },
    { pattern: /^\/cartas$/, title: "Cartas" },
    { pattern: /^\/admin$/, title: "Administração" },
];

export function routeTitle(pathname: string): string | null {
    const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    return ROUTE_TITLES.find((r) => r.pattern.test(clean))?.title ?? null;
}

export function documentTitleFor(pathname: string): string {
    const t = routeTitle(pathname);
    return t ? `${t} · ${APP_NAME}` : APP_NAME;
}
