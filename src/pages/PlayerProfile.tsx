import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { API_ENDPOINTS } from "../config/urls.ts";
import { PageHeader, PageShell, RatingPill, ResultPill, Outcome } from "../components/ui.tsx";
import { fmtDateBR } from "../utils/date.ts";
import ArchetypeBadge from "../components/archetypes/ArchetypeBadge.tsx";
import { ArchetypeTimeline, ArchetypeUsageList } from "../components/archetypes/ArchetypeUsageSection.tsx";
import PositionArchetypeFilter from "../components/archetypes/PositionArchetypeFilter.tsx";
import { useArchetypeFilter } from "../hooks/useArchetypeFilter.ts";
import { optionsFromAvailable, type ArchetypeOption } from "../utils/archetypeFilters.ts";
import { fmtNum } from "../utils/analyticsFormat.ts";
import type { ArchetypeChange, ArchetypeRef, ArchetypeUsage, AvailableArchetypeItem, AvailablePositionGroup, FilteredSummary } from "../types/archetypes.ts";

interface PlayerMatchHistoryDto {
    matchId: number;
    timestamp: string;
    goals: number;
    assists: number;
    preAssists: number;
    rating: number;
    pos: string;
    mom: boolean;
    secondsPlayed: number;
    result: string;
    goalsFor: number;
    goalsAgainst: number;
    opponentName: string | null;
    /** Arquétipo usado NESTA partida (null = sem dado). */
    archetype?: ArchetypeRef | null;
}

interface PlayerProfileDto {
    playerEntityId: number;
    name: string;
    accountName: string;
    playerId: number;
    clubId: number;
    totalMatches: number;
    totalWins: number;
    totalDraws: number;
    totalLosses: number;
    totalGoals: number;
    totalAssists: number;
    totalPreAssists: number;
    avgRating: number;
    totalMoM: number;
    totalRedCards: number;
    totalCleanSheets: number;
    totalSaves: number;
    hatTricks: number;
    bestRating: number;
    worstRating: number;
    bestRatingMatchId: number | null;
    worstRatingMatchId: number | null;
    mostGoalsInMatch: number;
    mostAssistsInMatch: number;
    proOverall: number | null;
    positions: Record<string, number>;
    history: PlayerMatchHistoryDto[];
    archetypes?: ArchetypeUsage[];
    archetypeChanges?: ArchetypeChange[];
    /** Com o filtro Posição → Arquétipo: resumo só dessas partidas (os totais acima não mudam). */
    filteredSummary?: FilteredSummary | null;
    positionGroup?: string | null;
    archetypeId?: number | null;
    availableArchetypes?: AvailableArchetypeItem[];
    availablePositionGroups?: AvailablePositionGroup[];
}


function fmtTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function ResultBadge({ result }: { result: string }) {
    const outcome: Outcome = result === "W" || result === "L" ? result : "D";
    return <ResultPill outcome={outcome} variant="soft" className="rounded-full" />;
}

const KpiCard: React.FC<{ label: string; value: number | string; sub?: string }> = ({ label, value, sub }) => (
    <div className="rounded-xl border bg-surface p-4 flex flex-col gap-1 shadow-sm">
        <div className="text-2xl font-black tabular-nums text-fg">{value}</div>
        <div className="text-xs font-medium text-fg-muted">{label}</div>
        {sub && <div className="text-[11px] text-fg-subtle">{sub}</div>}
    </div>
);

const SkeletonBlock: React.FC<{ h?: string }> = ({ h = "h-20" }) => (
    <div className={`rounded-xl border bg-surface-sunken animate-pulse ${h}`} />
);

function buildDist<T extends string | number>(
    values: T[],
    sorter: (a: T, b: T) => number
): { key: T; count: number }[] {
    const map = values.reduce<Record<string, number>>((acc, v) => {
        const k = String(v);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
    }, {});
    return Object.entries(map)
        .map(([k, count]) => ({ key: (typeof values[0] === "number" ? Number(k) : k) as T, count }))
        .sort((a, b) => sorter(a.key, b.key));
}

function DistBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-fg-muted w-10 text-right shrink-0">{label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((count / max) * 100)}%` }} />
            </div>
            <span className="text-xs text-fg-muted w-6 text-right shrink-0">{count}</span>
        </div>
    );
}

export default function PlayerProfile() {
    const { refreshKey } = useRefresh();
    const { playerEntityId } = useParams<{ playerEntityId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<PlayerProfileDto | null>(null);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [distOpen, setDistOpen] = useState(false);
    const [filter, setFilter] = useArchetypeFilter();
    const [options, setOptions] = useState<ArchetypeOption[]>([]);
    const lastPlayer = useRef<string | undefined>(undefined);
    const { positionGroup, archetypeId } = filter;
    // carregamento inicial (sem dados) mostra o esqueleto; trocar o filtro mantém a tela e só atualiza
    const loading = fetching && data === null;

    useEffect(() => {
        if (!playerEntityId) return;
        if (lastPlayer.current !== playerEntityId) {
            lastPlayer.current = playerEntityId;
            setData(null);
            setOptions([]);
        }
        const controller = new AbortController();
        const { signal } = controller;
        (async () => {
            setFetching(true);
            setError(null);
            try {
                const { data: resp } = await api.get<PlayerProfileDto>(
                    API_ENDPOINTS.PLAYER_PROFILE(Number(playerEntityId), { positionGroup, archetypeId }),
                    { signal }
                );
                if (signal.aborted) return;
                setData(resp);
                if (resp.availableArchetypes) setOptions(optionsFromAvailable(resp.availableArchetypes));
            } catch (e: any) {
                if (signal.aborted || isCanceled(e)) return;
                if (e?.response?.status === 404) {
                    setError("Jogador não encontrado.");
                } else if (e?.response?.status === 400) {
                    setError("Filtro inválido. Limpe o filtro de posição/arquétipo e tente de novo.");
                } else {
                    setError(e?.message ?? "Erro ao carregar perfil");
                }
            } finally {
                if (!signal.aborted) setFetching(false);
            }
        })();
        return () => controller.abort();
    }, [playerEntityId, refreshKey, positionGroup, archetypeId]);

    const filterActive = positionGroup !== null || archetypeId !== null;
    const clearFilter = () => setFilter({ positionGroup: null, archetypeId: null });

    const positionEntries = data
        ? Object.entries(data.positions).sort((a, b) => b[1] - a[1])
        : [];
    const maxPosCount = positionEntries[0]?.[1] ?? 1;

    return (
        <PageShell className="space-y-6">
            <PageHeader
                eyebrow="Jogador"
                title={data?.name ?? "Jogador"}
                subtitle={data ? `@${data.accountName}` : loading ? "Carregando…" : undefined}
                className="mb-0"
                actions={
                    <>
                        {data?.proOverall != null && (
                            <span className="px-3 py-1 rounded-full text-sm font-bold bg-accent text-accent-fg">
                                OVR {data.proOverall}
                            </span>
                        )}
                        <button
                            onClick={() => navigate(-1)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-surface hover:bg-surface-raised transition-colors text-fg-secondary"
                        >
                            ← Voltar
                        </button>
                    </>
                }
            />

            {error && (
                <div className="bg-negative-soft border border-negative/30 rounded-xl p-4 text-sm text-negative-fg">{error}</div>
            )}

            {loading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} h="h-20" />)}
                    </div>
                    <SkeletonBlock h="h-40" />
                    <SkeletonBlock h="h-64" />
                </div>
            )}

            {!loading && data && (
                <>
                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Estatísticas Gerais</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Partidas" value={data.totalMatches} />
                            <KpiCard label="V / E / D" value={`${data.totalWins} / ${data.totalDraws} / ${data.totalLosses}`} />
                            <KpiCard label="Gols" value={data.totalGoals} />
                            <KpiCard label="Assistências" value={data.totalAssists} />
                            <KpiCard label="Pré-Assists" value={data.totalPreAssists} />
                            <KpiCard label="Nota Média" value={data.avgRating.toFixed(2)} />
                            <KpiCard label="MoM" value={data.totalMoM} />
                            <KpiCard label="Hat-tricks" value={data.hatTricks} />
                            <KpiCard label="Expulsões" value={data.totalRedCards} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Recordes Pessoais</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-fg-muted">Melhor Nota</div>
                                <div className="text-2xl font-black text-positive">{data.bestRating.toFixed(2)}</div>
                                {data.bestRatingMatchId && (
                                    <Link to={`/match/${data.bestRatingMatchId}`} className="text-xs text-fg-subtle hover:text-accent underline underline-offset-2">
                                        Ver partida
                                    </Link>
                                )}
                            </div>
                            <div className="bg-surface rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-fg-muted">Pior Nota</div>
                                <div className="text-2xl font-black text-negative">{data.worstRating.toFixed(2)}</div>
                                {data.worstRatingMatchId && (
                                    <Link to={`/match/${data.worstRatingMatchId}`} className="text-xs text-fg-subtle hover:text-accent underline underline-offset-2">
                                        Ver partida
                                    </Link>
                                )}
                            </div>
                            <div className="bg-surface rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-fg-muted">Mais Gols numa Partida</div>
                                <div className="text-2xl font-black text-fg">{data.mostGoalsInMatch}</div>
                            </div>
                            <div className="bg-surface rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-fg-muted">Mais Assists numa Partida</div>
                                <div className="text-2xl font-black text-fg">{data.mostAssistsInMatch}</div>
                            </div>
                        </div>
                    </div>

                    {data.history.length > 0 && (() => {
                        const ratingDist = buildDist(
                            data.history.map(h => Math.floor(h.rating)),
                            (a, b) => a - b
                        );
                        const goalsDist = buildDist(
                            data.history.map(h => h.goals),
                            (a, b) => a - b
                        );
                        const maxR = Math.max(...ratingDist.map(d => d.count));
                        const maxG = Math.max(...goalsDist.map(d => d.count));

                        const ratingColor = (key: number) =>
                            key >= 9 ? "bg-quality-great" : key >= 7 ? "bg-quality-good" : key >= 6 ? "bg-quality-decent" : "bg-quality-poor";

                        return (
                            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setDistOpen(v => !v)}
                                    className="w-full px-4 py-3 border-b bg-surface-raised flex items-center justify-between hover:bg-surface-sunken transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-fg text-sm">📊 Distribuição por Nota e Gols</span>
                                        <span className="text-xs bg-surface-sunken text-fg-muted px-2 py-0.5 rounded-full">
                                            {data.history.length} partidas
                                        </span>
                                    </div>
                                    <span className="text-fg-subtle text-sm">{distOpen ? "▲" : "▼"}</span>
                                </button>

                                {distOpen && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                                        <div className="p-4 space-y-2">
                                            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Por Nota</p>
                                            {ratingDist.map(({ key, count }) => (
                                                <DistBar
                                                    key={key}
                                                    label={key === 10 ? "10" : `${key}.x`}
                                                    count={count}
                                                    max={maxR}
                                                    color={ratingColor(key)}
                                                />
                                            ))}
                                        </div>
                                        <div className="p-4 space-y-2">
                                            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Por Gols</p>
                                            {goalsDist.map(({ key, count }) => (
                                                <DistBar
                                                    key={key}
                                                    label={key === 0 ? "0" : `${key}G`}
                                                    count={count}
                                                    max={maxG}
                                                    color="bg-accent"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {positionEntries.length > 0 && (
                        <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-surface-raised">
                                <span className="font-semibold text-fg text-sm">Posições Jogadas</span>
                            </div>
                            <div className="divide-y">
                                {positionEntries.map(([pos, count]) => (
                                    <div key={pos} className="px-4 py-3 flex items-center gap-3">
                                        <span className="text-sm font-bold text-fg-secondary w-12">{pos || "—"}</span>
                                        <div className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-accent"
                                                style={{ width: `${Math.round((count / maxPosCount) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-fg-muted w-8 text-right">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <section aria-labelledby="profile-filter-title" className="bg-surface rounded-xl border shadow-sm p-4 space-y-3" aria-busy={fetching}>
                        <h2 id="profile-filter-title" className="font-semibold text-fg text-sm">Filtrar por posição e arquétipo</h2>
                        <PositionArchetypeFilter value={filter} onChange={setFilter} archetypeOptions={options} showCount countUnit={["jogo", "jogos"]} />
                        <p className="text-xs text-fg-muted">
                            Vale para o histórico de partidas e a distribuição. A posição também filtra a seção Arquétipos, que continua listando todos os arquétipos dela. Os totais e recordes de cima não mudam.
                        </p>
                        {filterActive && (
                            <div role="status" className="rounded-lg border border-border bg-surface-raised p-3 text-sm space-y-2">
                                {data.filteredSummary && data.filteredSummary.matches > 0 ? (
                                    <>
                                        <p className="font-semibold text-fg">
                                            {data.filteredSummary.matches} {data.filteredSummary.matches === 1 ? "jogo" : "jogos"} com este filtro
                                        </p>
                                        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 text-xs">
                                            <div>
                                                <dt className="text-fg-subtle">V / E / D</dt>
                                                <dd className="font-semibold tabular-nums text-fg-secondary">
                                                    {data.filteredSummary.wins} / {data.filteredSummary.draws} / {data.filteredSummary.losses}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-subtle">Gols</dt>
                                                <dd className="font-semibold tabular-nums text-fg-secondary">{data.filteredSummary.goals}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-subtle">Assistências</dt>
                                                <dd className="font-semibold tabular-nums text-fg-secondary">{data.filteredSummary.assists}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-subtle">Nota média</dt>
                                                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(data.filteredSummary.avgRating, 2)}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-subtle">Overall médio</dt>
                                                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(data.filteredSummary.avgProOverall, 1)}</dd>
                                            </div>
                                        </dl>
                                    </>
                                ) : (
                                    <p className="text-fg-muted">
                                        {fetching ? "Atualizando…" : "Nenhum jogo deste jogador com este filtro."}
                                    </p>
                                )}
                                <button type="button" className="btn btn-secondary min-h-[44px]" onClick={clearFilter}>
                                    Limpar filtro
                                </button>
                            </div>
                        )}
                    </section>

                    {data.archetypes && data.archetypes.length > 0 && (
                        <section aria-labelledby="profile-arch-title" className="bg-surface rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-surface-raised flex items-center justify-between gap-2">
                                <h2 id="profile-arch-title" className="font-semibold text-fg text-sm">Arquétipos</h2>
                                <span className="text-xs bg-surface-sunken text-fg-muted px-2 py-0.5 rounded-full">
                                    {data.archetypes.length} {data.archetypes.length === 1 ? "usado" : "usados"}
                                </span>
                            </div>
                            <ArchetypeUsageList usage={data.archetypes} />
                            {(() => {
                                const withData = data.archetypes.reduce((a, u) => a + u.matches, 0);
                                const without = data.totalMatches - withData;
                                return !filterActive && without > 0 ? (
                                    <p className="px-4 py-2 border-t text-[11px] text-fg-subtle">
                                        {without} {without === 1 ? "partida" : "partidas"} sem arquétipo registrado (partidas antigas) não entram na conta.
                                    </p>
                                ) : null;
                            })()}
                            <div className="px-4 py-3 border-t">
                                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Trocas de arquétipo</h3>
                                {data.archetypeChanges && data.archetypeChanges.length > 0 ? (
                                    <ArchetypeTimeline changes={data.archetypeChanges} />
                                ) : (
                                    <p className="text-sm text-fg-muted">Nenhuma troca registrada: sempre o mesmo arquétipo.</p>
                                )}
                            </div>
                        </section>
                    )}

                    <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-surface-raised flex items-center justify-between">
                            <span className="font-semibold text-fg text-sm">Histórico de Partidas</span>
                            <span className="text-xs bg-surface-sunken text-fg-muted px-2 py-0.5 rounded-full">{data.history.length} partidas</span>
                        </div>
                        {data.history.length === 0 && (
                            <p role="status" className="px-4 py-6 text-sm text-fg-muted text-center">
                                {filterActive ? "Nenhuma partida com este filtro." : "Nenhuma partida."}
                            </p>
                        )}
                        <div className={`overflow-x-auto max-h-[600px] overflow-y-auto ${data.history.length === 0 ? "hidden" : ""}`}>
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-surface-raised/90 backdrop-blur-sm z-10">
                                    <tr className="border-b text-fg-muted text-xs uppercase tracking-wide">
                                        <th scope="col" className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Data</th>
                                        <th scope="col" className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Adversário</th>
                                        <th scope="col" className="text-center px-3 py-2.5 font-medium">Res.</th>
                                        <th scope="col" className="text-center px-3 py-2.5 font-medium">G/A/P</th>
                                        <th scope="col" className="text-center px-3 py-2.5 font-medium">Nota</th>
                                        <th scope="col" className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Pos / Arq.</th>
                                        <th scope="col" className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Tempo</th>
                                        <th scope="col" className="px-4 py-2.5 font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.history.map((h, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-surface-raised transition-colors">
                                            <td className="px-4 py-3 text-fg-muted text-xs whitespace-nowrap">{fmtDateBR(h.timestamp)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-fg-secondary truncate max-w-[120px]">{h.opponentName ?? "—"}</span>
                                                    <span className="text-xs text-fg-subtle whitespace-nowrap">{h.goalsFor}–{h.goalsAgainst}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <ResultBadge result={h.result} />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="font-mono text-xs text-fg-secondary">
                                                    {h.goals}/{h.assists}/{h.preAssists}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <RatingPill value={h.rating} size="sm" />
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-semibold text-fg-muted">
                                                <div>{h.pos || "—"}</div>
                                                <ArchetypeBadge archetype={h.archetype} compact hideEmpty={!data.archetypes?.length} className="mt-1 max-w-[7rem] truncate align-middle" />
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs text-fg-muted whitespace-nowrap">{fmtTime(h.secondsPlayed)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    to={`/match/${h.matchId}`}
                                                    className="text-xs text-fg-subtle hover:text-accent underline underline-offset-2"
                                                >
                                                    Ver
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </PageShell>
    );
}
