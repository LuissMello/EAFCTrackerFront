// src/pages/PlayerAttributesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { clamp01to100 } from "../utils/number.ts";
import { mapAttr, pick } from "../utils/playerAttributes.ts";
import type { PlayerMatchStats } from "../types/playerAttributes.ts";
import { ATTR_LABELS } from "../utils/playerAttributes.ts";
import { Card, ProgressBar, ErrorState } from "../components/AttributeUi.tsx";
import { EmptyState, PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import ArchetypeBadge, { archetypeShortLabel } from "../components/archetypes/ArchetypeBadge.tsx";
import type { ArchetypeRef } from "../types/archetypes.ts";
import PositionArchetypeFilter from "../components/archetypes/PositionArchetypeFilter.tsx";
import { useArchetypeFilter } from "../hooks/useArchetypeFilter.ts";
import { archetypeOptionsForPosition, archetypeOptionsOf, positionGroupOfPos } from "../utils/archetypeFilters.ts";

/******** Helpers ********/
function isAbort(err: any) {
    return (
        err?.name === "CanceledError" ||
        err?.message === "canceled" ||
        err?.code === "ERR_CANCELED" ||
        err?.__CANCEL__ === true
    );
}

/******** Tipos ********/
type PlayerAttrRow = {
    playerId: number;
    playerName: string;
    clubId: number;
    pos?: string | null;
    /** Arquétipo usado na partida deste snapshot (0/null = sem dado). */
    archetypeId: number;
    archetype: ArchetypeRef | null;
    statistics: PlayerMatchStats | null;
};

const NOTE_CLS =
    "flex items-start gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-fg-secondary";

/** O jogador tem algum atributo coletado (valores todos zerados/ausentes = sem dados). */
function hasAttrData(r: PlayerAttrRow): boolean {
    return !!r.statistics && Object.values(r.statistics).some((v) => !!v && v !== 0);
}

function isGk(pos?: string | null) {
    if (!pos) return false;
    const p = pos.trim().toLowerCase();
    return p === "gk" || p === "gol" || p === "goalkeeper" || p === "goleiro";
}

/******** Página ********/
export default function PlayerAttributesPage() {
    const { refreshKey } = useRefresh();
    const { clubId, clubName } = useClub();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<PlayerAttrRow[]>([]);

    // seleção
    const [basePlayerId, setBasePlayerId] = useState<number | "">("");
    const [compareMode, setCompareMode] = useState<"media" | "player">("media");
    const [comparePlayerId, setComparePlayerId] = useState<number | "">("");
    const [avgScope, setAvgScope] = useState<"mesmo" | "todos">("mesmo");
    const [filter, setFilter] = useArchetypeFilter();

    useEffect(() => {
        if (!clubId) {
            setError("Nenhum clube selecionado.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        (async () => {
            try {
                // sem count => pega o snapshot mais novo por jogador
                const { data } = await api.get(`/api/clubs/${clubId}/players/attributes`, {
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                const arr: any[] = Array.isArray(data) ? data : [];

                const mapped: PlayerAttrRow[] = arr.map((row) => ({
                    playerId: Number(pick(row, "playerId", "PlayerId")),
                    playerName: String(pick(row, "playerName", "PlayerName") ?? ""),
                    clubId: Number(pick(row, "clubId", "ClubId") ?? 0),
                    pos: pick<string>(row, "pos", "Pos") ?? null,
                    archetypeId: Number(pick(row, "archetypeId", "ArchetypeId") ?? pick<ArchetypeRef | null>(row, "archetype", "Archetype")?.id ?? 0) || 0,
                    archetype: pick<ArchetypeRef | null>(row, "archetype", "Archetype") ?? null,
                    statistics: mapAttr(pick(row, "statistics", "Statistics")),
                }));

                setRows(mapped);
                // default: primeiro jogador COM dados de atributos (não um que apareça vazio)
                const firstWithData = mapped.find(hasAttrData);
                setBasePlayerId(firstWithData ? firstWithData.playerId : "");
            } catch (e: any) {
                if (controller.signal.aborted || isAbort(e)) return;
                setError(e?.message ?? "Erro ao buscar atributos do clube");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [clubId, refreshKey]);

    // Filtro Posição → Arquétipo (client-side) sobre o snapshot mais novo de cada jogador.
    // Posição = grupo da posição do snapshot (ou o grupo do arquétipo, se a posição faltar); arquétipo = o do snapshot.
    const filteredRows = useMemo(
        () =>
            rows.filter((r) => {
                if (filter.positionGroup && (positionGroupOfPos(r.pos) ?? r.archetype?.positionGroup ?? null) !== filter.positionGroup) return false;
                if (filter.archetypeId !== null && r.archetypeId !== filter.archetypeId) return false;
                return true;
            }),
        [rows, filter]
    );
    const archetypeOptions = useMemo(
        () => archetypeOptionsForPosition(archetypeOptionsOf(rows), filter.positionGroup),
        [rows, filter.positionGroup]
    );
    const filterActive = filter.positionGroup !== null || filter.archetypeId !== null;

    // se o jogador base saiu do filtro, usa o primeiro (com dados) que sobrou
    const effectiveBaseId: number | "" = useMemo(() => {
        if (filteredRows.some((r) => String(r.playerId) === String(basePlayerId))) return basePlayerId;
        const first = filteredRows.find(hasAttrData) ?? filteredRows[0];
        return first ? first.playerId : "";
    }, [filteredRows, basePlayerId]);

    const base = useMemo(
        () => filteredRows.find((r) => String(r.playerId) === String(effectiveBaseId)),
        [filteredRows, effectiveBaseId]
    );

    // Médias de atributos NÃO misturam arquétipos por padrão: cada arquétipo distribui os pontos de um jeito.
    const averages = useMemo(() => {
        const avgOf = (list: PlayerAttrRow[]) => {
            const statsAll = list.map((r) => r.statistics).filter(Boolean) as PlayerMatchStats[];
            if (statsAll.length === 0) return null;
            const keys = Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[];
            const avg: Record<string, number> = {};
            keys.forEach((k) => {
                const vals = statsAll.map((s) => Number((s as any)[k])).filter((v) => Number.isFinite(v));
                avg[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            });
            return avg as Record<keyof PlayerMatchStats, number>;
        };
        // desconsidera goleiros e quem não tem atributos coletados
        const field = filteredRows.filter((r) => (filter.positionGroup === "GOLEIRO" || !isGk(r.pos)) && hasAttrData(r));
        const sameArch =
            base && base.archetypeId > 0
                ? field.filter((r) => r.archetypeId === base.archetypeId && r.playerId !== base.playerId)
                : [];
        const distinctArch = new Set(field.map((r) => r.archetypeId || 0));
        return {
            all: avgOf(field),
            allCount: field.length,
            mixed: distinctArch.size > 1,
            same: avgOf(sameArch),
            sameCount: sameArch.length,
        };
    }, [filteredRows, filter.positionGroup, base]);

    // "mesmo arquétipo" só vale quando há outros jogadores com o arquétipo do jogador base
    const effectiveScope: "mesmo" | "todos" = avgScope === "mesmo" && averages.sameCount > 0 ? "mesmo" : "todos";
    const teamAverage = effectiveScope === "mesmo" ? averages.same : averages.all;

    const comparePlayer = useMemo(
        () => (comparePlayerId ? filteredRows.find((r) => String(r.playerId) === String(comparePlayerId)) : undefined),
        [filteredRows, comparePlayerId]
    );

    const compare = useMemo(() => {
        if (compareMode === "media") return teamAverage;
        return comparePlayer?.statistics ?? null;
    }, [compareMode, teamAverage, comparePlayer]);

    /******** Render ********/
    if (loading) {
        return (
            <PageShell aria-busy>
                <PageHeader eyebrow="Clube" title="Atributos" subtitle="Carregando…" />
                <Skeleton className="h-24 w-full mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="h-14" />
                    ))}
                </div>
            </PageShell>
        );
    }
    if (!clubId) {
        return (
            <PageShell>
                <PageHeader eyebrow="Clube" title="Atributos" />
                <EmptyState icon="📊" title="Nenhum clube selecionado">
                    Selecione um clube no menu superior para ver os atributos.
                </EmptyState>
            </PageShell>
        );
    }
    if (error) {
        return (
            <PageShell>
                <PageHeader eyebrow="Clube" title="Atributos" subtitle={clubName ?? undefined} />
                <ErrorState message={error} onRetry={() => window.location.reload()} />
            </PageShell>
        );
    }
    if (rows.length === 0) {
        return (
            <PageShell>
                <PageHeader eyebrow="Clube" title="Atributos" subtitle={clubName ?? undefined} />
                <EmptyState icon="📊" title="Nenhum atributo encontrado">
                    Ainda não há dados de atributos para o clube {clubName ?? clubId}.
                </EmptyState>
            </PageShell>
        );
    }

    if (!rows.some(hasAttrData)) {
        return (
            <PageShell>
                <PageHeader eyebrow="Clube" title="Atributos" subtitle={clubName ?? undefined} />
                <EmptyState icon="📊" title="Ainda não há atributos coletados">
                    Os atributos dos jogadores (ritmo, finalização, passe, etc.) vêm da última partida em que cada um jogou.
                    Nenhum jogador de {clubName ?? `clube ${clubId}`} tem esses dados no momento — eles aparecem aqui
                    automaticamente depois da próxima busca de partidas.
                </EmptyState>
            </PageShell>
        );
    }

    const allPlayersForSelect = filteredRows
        .map((r) => ({
            id: r.playerId,
            name: r.playerName,
            label: r.archetype ? `${r.playerName} · ${archetypeShortLabel(r.archetype)}` : r.playerName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <PageShell>
            <PageHeader eyebrow="Clube" title="Atributos" subtitle={clubName ?? `Clube ${clubId}`} />

            <Card>
                {/* Filtro Posição → Arquétipo */}
                <div className="mb-4 space-y-2">
                    <PositionArchetypeFilter value={filter} onChange={setFilter} archetypeOptions={archetypeOptions} showCount countUnit={["jogador", "jogadores"]} />
                    <p role="status" className="text-xs text-fg-muted">
                        {filterActive
                            ? `Mostrando ${filteredRows.length} de ${rows.length} ${rows.length === 1 ? "jogador" : "jogadores"}: só quem está nesta posição/arquétipo na última partida. Lista, jogador base e médias seguem o filtro.`
                            : "Filtra os jogadores pela posição e pelo arquétipo da última partida de cada um (a média considera só quem sobrar)."}
                    </p>
                </div>

                {filteredRows.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface-raised p-6 text-center text-sm text-fg-muted space-y-3">
                        <p>Nenhum jogador com este filtro.</p>
                        <button type="button" className="btn btn-secondary min-h-[44px]" onClick={() => setFilter({ positionGroup: null, archetypeId: null })}>
                            Limpar filtro
                        </button>
                    </div>
                ) : (
                <>
                {/* Seleções */}
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div>
                        <label className="block text-xs font-semibold mb-1">Jogador base</label>
                        <select
                            className="border rounded px-3 py-2 text-sm min-w-[220px]"
                            value={effectiveBaseId}
                            onChange={(e) => setBasePlayerId(e.target.value ? Number(e.target.value) : "")}
                        >
                            {allPlayersForSelect.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1">Comparar com</label>
                        <select
                            className="border rounded px-3 py-2 text-sm"
                            value={compareMode}
                            onChange={(e) => {
                                const v = e.target.value as "media" | "player";
                                setCompareMode(v);
                                if (v === "media") setComparePlayerId("");
                            }}
                        >
                            <option value="media">Média do clube</option>
                            <option value="player">Outro jogador</option>
                        </select>
                    </div>

                    {compareMode === "media" && (
                        <div>
                            <label htmlFor="attr-avg-scope" className="block text-xs font-semibold mb-1">Média de</label>
                            <select
                                id="attr-avg-scope"
                                className="border rounded px-3 py-2 text-sm min-w-[200px]"
                                value={effectiveScope}
                                onChange={(e) => setAvgScope(e.target.value as "mesmo" | "todos")}
                            >
                                <option value="mesmo" disabled={averages.sameCount === 0}>
                                    {base?.archetype
                                        ? `Mesmo arquétipo (${base.archetype.label}) · ${averages.sameCount}`
                                        : "Mesmo arquétipo"}
                                </option>
                                <option value="todos">Todos os arquétipos · {averages.allCount}</option>
                            </select>
                        </div>
                    )}

                    {compareMode === "player" && (
                        <div>
                            <label className="block text-xs font-semibold mb-1">Jogador para comparar</label>
                            <select
                                className="border rounded px-3 py-2 text-sm min-w-[220px]"
                                value={comparePlayerId}
                                onChange={(e) => setComparePlayerId(e.target.value ? Number(e.target.value) : "")}
                            >
                                <option value="">Selecionar…</option>
                                {allPlayersForSelect
                                    .filter((p) => String(p.id) !== String(effectiveBaseId))
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Comparação */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Base: lista de atributos */}
                    <Card>
                        <h3 className="text-base font-semibold mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Atributos — {base?.playerName ?? "—"}</span>
                            {base && <ArchetypeBadge archetype={base.archetype} emphasis />}
                        </h3>
                        {base && !base.archetype && (
                            <p className="text-xs text-fg-subtle mb-3">Sem arquétipo registrado na última partida deste jogador.</p>
                        )}
                        {base?.statistics && Object.values(base.statistics).some((v) => v && v !== 0) ? (
                            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-fg-secondary">
                                {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => (
                                    <li key={String(key)} className="col-span-1">
                                        <ProgressBar
                                            value={Number((base.statistics as any)[key]) || 0}
                                            label={ATTR_LABELS[key]}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-warning-fg bg-warning-soft border border-warning/30 rounded-lg p-3">
                                Dados de atributos não disponíveis para este jogador.
                            </div>
                        )}
                    </Card>

                    {/* Comparação com média ou outro jogador */}
                    <Card>
                        <h3 className="text-base font-semibold mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                                Comparação —{" "}
                                {compareMode === "media"
                                    ? effectiveScope === "mesmo"
                                        ? "Média do mesmo arquétipo"
                                        : "Média do clube"
                                    : comparePlayer?.playerName ?? "—"}
                            </span>
                            {compareMode === "player" && comparePlayer && <ArchetypeBadge archetype={comparePlayer.archetype} emphasis />}
                            {compareMode === "media" && effectiveScope === "mesmo" && base?.archetype && (
                                <ArchetypeBadge archetype={base.archetype} emphasis />
                            )}
                        </h3>
                        {compareMode === "media" && effectiveScope === "mesmo" && (
                            <p className={`${NOTE_CLS} mb-3`} role="note">
                                Média de {averages.sameCount} {averages.sameCount === 1 ? "outro jogador" : "outros jogadores"} de linha com o
                                mesmo arquétipo ({base?.archetype?.label}).
                            </p>
                        )}
                        {compareMode === "media" && effectiveScope === "todos" && averages.mixed && (
                            <p className={`${NOTE_CLS} mb-3`} role="note">
                                Arquétipos diferentes: esta média mistura jogadores de linha com arquétipos distintos — compare com cuidado.
                                {avgScope === "mesmo" && base && averages.sameCount === 0 && (
                                    <> Não há outro jogador com o arquétipo do jogador base.</>
                                )}
                            </p>
                        )}
                        {compareMode === "player" &&
                            base &&
                            comparePlayer &&
                            base.archetypeId > 0 &&
                            comparePlayer.archetypeId > 0 &&
                            base.archetypeId !== comparePlayer.archetypeId && (
                                <p className={`${NOTE_CLS} mb-3`} role="note">
                                    Arquétipos diferentes ({base.archetype?.label} × {comparePlayer.archetype?.label}): os atributos são
                                    distribuídos de outro jeito — compare com cuidado.
                                </p>
                            )}
                        {compareMode === "player" && base && comparePlayer && (base.archetypeId === 0 || comparePlayer.archetypeId === 0) && (
                            <p className={`${NOTE_CLS} mb-3`} role="note">
                                Um dos jogadores está sem arquétipo registrado; não dá para saber se os arquétipos são iguais.
                            </p>
                        )}

                        {compare && Object.values(compare).some((v) => v && v !== 0) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => {
                                    const mine = clamp01to100(Number((base?.statistics as any)?.[key] ?? 0));
                                    const other = clamp01to100(Number((compare as any)?.[key] ?? 0));

                                    // tolerância para considerar "igual"
                                    const EPS = 0.5; // 0.5 ponto ~ ajuste se quiser mais/menos rígido
                                    const diff = Number(mine - other);
                                    const isEqual = Math.abs(diff) <= EPS;
                                    const isAbove = diff > EPS;
                                    const isBelow = diff < -EPS;

                                    const badgeClass = isEqual
                                        ? "bg-warning-soft text-warning-fg"
                                        : isAbove
                                            ? "bg-positive-soft text-positive-fg"
                                            : "bg-negative-soft text-negative-fg";

                                    const badgeText = isEqual ? "Igual" : isAbove ? "Acima" : "Abaixo";

                                    // Mostra o delta com sinal (ex.: +3 / -2)
                                    const deltaText =
                                        (isEqual ? "±0" : `${diff > 0 ? "+" : ""}${Math.round(diff)}`) + "";

                                    return (
                                        <div key={String(key)} className="rounded-xl border p-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-fg">
                                                    {ATTR_LABELS[key]}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                    {badgeText} <span className="opacity-70">({deltaText})</span>
                                                </span>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-fg-muted">
                                                    Base: {Math.round(mine)}
                                                </div>
                                                <div className="w-full bg-surface-sunken rounded h-2 overflow-hidden">
                                                    <div className="h-2 bg-accent" style={{ width: `${mine}%` }} />
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-fg-muted">
                                                    {compareMode === "media" ? (effectiveScope === "mesmo" ? "Mesmo arquétipo (média)" : "Clube (média)") : "Comparação"}:{" "}
                                                    {Math.round(other)}
                                                </div>
                                                <div className="w-full bg-surface-sunken rounded h-2 overflow-hidden">
                                                    <div
                                                        className="h-2 bg-fg-muted"
                                                        style={{ width: `${other}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-fg-muted">
                                {compareMode === "player"
                                    ? "Selecione um jogador para comparar."
                                    : "Sem dados para média."}
                            </div>
                        )}

                    </Card>
                </div>
                </>
                )}
            </Card>
        </PageShell>
    );
}
