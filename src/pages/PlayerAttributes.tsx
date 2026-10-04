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
    statistics: PlayerMatchStats | null;
};

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

    const base = useMemo(
        () => rows.find((r) => String(r.playerId) === String(basePlayerId)),
        [rows, basePlayerId]
    );

    const teamAverage = useMemo(() => {
        if (rows.length === 0) return null;

        // desconsidera goleiros por garantia
        const fieldPlayers = rows.filter(r => !isGk(r.pos));
        const statsAll = fieldPlayers
            .map((r) => r.statistics)
            .filter(Boolean) as PlayerMatchStats[];

        if (statsAll.length === 0) return null;

        const keys = Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[];
        const avg: Record<string, number> = {};
        keys.forEach((k) => {
            const vals = statsAll.map((s) => Number((s as any)[k])).filter((v) => Number.isFinite(v));
            avg[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        return avg as Record<keyof PlayerMatchStats, number>;
    }, [rows]);

    const compare = useMemo(() => {
        if (compareMode === "media") return teamAverage;
        if (!comparePlayerId) return null;
        const pl = rows.find((r) => String(r.playerId) === String(comparePlayerId));
        return pl?.statistics ?? null;
    }, [compareMode, comparePlayerId, teamAverage, rows]);

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

    const allPlayersForSelect = rows
        .map((r) => ({ id: r.playerId, name: r.playerName }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <PageShell>
            <PageHeader eyebrow="Clube" title="Atributos" subtitle={clubName ?? `Clube ${clubId}`} />

            <Card>
                {/* Seleções */}
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div>
                        <label className="block text-xs font-semibold mb-1">Jogador base</label>
                        <select
                            className="border rounded px-3 py-2 text-sm min-w-[220px]"
                            value={basePlayerId}
                            onChange={(e) => setBasePlayerId(e.target.value ? Number(e.target.value) : "")}
                        >
                            {allPlayersForSelect.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
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
                                    .filter((p) => String(p.id) !== String(basePlayerId))
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
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
                        <h3 className="text-base font-semibold mb-3">Atributos — {base?.playerName ?? "—"}</h3>
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
                        <h3 className="text-base font-semibold mb-3">
                            Comparação — {compareMode === "media" ? "Média do clube" : rows.find((r) => String(r.playerId) === String(comparePlayerId))?.playerName ?? "—"}
                        </h3>

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
                                                    {compareMode === "media" ? "Clube (média)" : "Comparação"}:{" "}
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
            </Card>
        </PageShell>
    );
}
