import React, { useMemo, useState, useEffect } from "react";
import { PlayerStats, ClubStats } from "../types/stats.ts";
import { classifyStat, getStatQualityDetails } from "../utils/statClassifier.ts";
import { Tooltip } from "./Tooltip.tsx";
import { PlugZap, Star, RectangleVertical } from "lucide-react";
import { GiGoalKeeper } from "react-icons/gi";

interface PlayerStatsTableProps {
    players: PlayerStats[];
    loading: boolean;
    error: string | null;
    clubStats: ClubStats | null;
    minMatches?: number;
    searchTerm?: string;
    initialSortKey?: keyof PlayerStats;
    initialSortOrder?: "asc" | "desc";
    pageSize?: number;
    showPagination?: boolean;
    showSearch?: boolean;
    showTitle?: boolean;
    hiddenColumns?: string[];
    onSortChange?: (key: keyof PlayerStats, order: "asc" | "desc") => void;
    /** Quando true, oculta o cabeçalho e o rodapé/paginação */
    compactMode?: boolean;
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

function useNumberFormats() {
    const int = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
    const p1 = useMemo(() => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }), []);
    const p2 = useMemo(
        () => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        []
    );
    return { int, p1, p2 };
}

function SortIcon({ active, order }: { active: boolean; order: "asc" | "desc" }) {
    if (!active)
        return (
            <span aria-hidden className="opacity-30">
                ↕
            </span>
        );
    return <span aria-hidden>{order === "asc" ? "▲" : "▼"}</span>;
}

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function CellBar({
    value,
    max,
    suffix = "",
    positive = false,
    format = (n: number) => String(n),
    statType,
}: {
    value: number;
    max: number;
    suffix?: string;
    positive?: boolean;
    format?: (n: number) => string;
    statType?: string;
}) {
    const width = clamp((value / (max || 1)) * 100);
    const quality = statType ? classifyStat(statType, value) : null;

    let barColor = positive ? "bg-emerald-200" : "bg-gray-300";
    if (quality) {
        const qualityColors: Record<string, string> = {
            poor: "bg-red-200",
            decent: "bg-orange-200",
            good: "bg-green-200",
            veryGood: "bg-blue-200",
        };
        barColor = qualityColors[quality.level];
    }

    const cellBarContent = (
        <div className="relative w-full h-6 rounded-md border border-gray-200 overflow-hidden bg-gray-50">
            <div className={`h-full ${barColor}`} style={{ width: `${width}%` }} />
            <div className="absolute inset-0 grid place-items-center text-xs font-medium">
                {format(value)}
                {suffix}
            </div>
        </div>
    );

    return statType ? (
        <Tooltip content={getStatQualityDetails(statType, value) || `${format(value)}${suffix}`} wrapperClassName="block">
            {cellBarContent}
        </Tooltip>
    ) : (
        cellBarContent
    );
}

export function PlayerStatsTable({
    players,
    loading,
    error,
    clubStats,
    minMatches = 1,
    searchTerm = "",
    initialSortKey = "totalGoals",
    initialSortOrder = "desc",
    pageSize = 20,
    showPagination = true,
    showSearch = true,
    showTitle = true,
    hiddenColumns = [],
    onSortChange,
    compactMode = false,
}: PlayerStatsTableProps) {
    const [sortKey, setSortKey] = useState<keyof PlayerStats>(initialSortKey);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
    const [page, setPage] = useState(1);
    const { int, p1, p2 } = useNumberFormats();

    // aplica compactMode: força esconder título e paginação
    const effectiveShowTitle = compactMode ? false : showTitle;
    const effectiveShowPagination = compactMode ? false : showPagination;

    // Filter players
    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return players
            .filter((p) => p.matchesPlayed >= minMatches)
            .filter((p) => (term ? p.playerName.toLowerCase().includes(term) : true));
    }, [players, minMatches, searchTerm]);

    // Sort players
    const sorted = useMemo(() => {
        const cp = [...filtered];
        cp.sort((a, b) => {
            // Handle computed "participations" column
            if (sortKey === ("participations" as any)) {
                const va = (Number(a.totalGoals) || 0) + (Number(a.totalAssists) || 0) + (Number(a.totalPreAssists) || 0);
                const vb = (Number(b.totalGoals) || 0) + (Number(b.totalAssists) || 0) + (Number(b.totalPreAssists) || 0);
                return sortOrder === "asc" ? va - vb : vb - va;
            }
            const va = a[sortKey] as any;
            const vb = b[sortKey] as any;
            if (typeof va === "number" && typeof vb === "number") return sortOrder === "asc" ? va - vb : vb - va;
            const sa = String(va);
            const sb = String(vb);
            return sortOrder === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        return cp;
    }, [filtered, sortKey, sortOrder]);

    // Calculate max values for bars
    const maxByKey = useMemo(() => {
        const keys: (keyof PlayerStats)[] = [
            "totalGoals",
            "totalAssists",
            "totalPreAssists",
            "totalShots",
            "totalPassesMade",
            "totalTacklesMade",
            "avgRating",
            "winPercent",
            "passAccuracyPercent",
            "tackleSuccessPercent",
            "goalAccuracyPercent",
            "totalSaves",
        ];
        const res = new Map<keyof PlayerStats | "participations", number>();
        keys.forEach((k) => res.set(k, Math.max(1, ...filtered.map((p) => Number(p[k]) || 0))));
        // Participations = goals + assists + preAssists
        res.set("participations", Math.max(1, ...filtered.map((p) =>
            (Number(p.totalGoals) || 0) + (Number(p.totalAssists) || 0) + (Number(p.totalPreAssists) || 0)
        )));
        return res;
    }, [filtered]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page, pageSize]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [minMatches, searchTerm, sortKey, sortOrder, pageSize]);

    function handleSort(key: keyof PlayerStats) {
        if (sortKey === key) {
            const newOrder = sortOrder === "asc" ? "desc" : "asc";
            setSortOrder(newOrder);
            onSortChange?.(key, newOrder);
        } else {
            setSortKey(key);
            setSortOrder("desc");
            onSortChange?.(key, "desc");
        }
    }

    const clubGoalsAgainst = Number(clubStats?.totalGoalsConceded || 0);

    // Check if any player has goalkeeper stats
    const hasGoalkeeperStats = useMemo(() => {
        return filtered.some((p) => {
            const saves = Number(p.totalSaves || 0);
            const isGk = ((p as any).position?.toUpperCase?.() === "GK");
            return saves > 0 || isGk;
        });
    }, [filtered]);

    const allColumns = [
        { key: "proName", label: "Jogador", tooltip: "Nome do jogador" },
        { key: "matchesPlayed", label: "Partidas" },
        { key: "participations", label: "Partic.", tooltip: "Participações em gols (Gols + Assistências + Pré-Assistências)" },
        { key: "totalGoals", label: "Gols" },
        { key: "totalAssists", label: "Assistências" },
        { key: "totalPreAssists", label: "Pré-Assist", tooltip: "Passes que resultaram em assistências" },
        { key: "totalShots", label: "Chutes", tooltip: "Gols / Tentativas totais e % de conversão" },
        ...(hasGoalkeeperStats ? [{
            key: "totalSaves",
            label: "Defesas",
            tooltip: "Defesas e Gols Sofridos do CLUBE no período: % = S / (S + Gc)",
        }] : []),
        { key: "totalPassesMade", label: "Passes", tooltip: "Completos / Tentados e %" },
        {
            key: "totalTacklesMade",
            label: "Desarmes",
            tooltip: "Desarmes certos / tentados e %",
        },
        { key: "record", label: "V/E/D", tooltip: "Vitórias / Empates / Derrotas" },
        { key: "winPercent", label: "Win %" },
        { key: "totalMom", label: "MOM" },
        { key: "avgRating", label: "Nota" },
    ];

    const columns = allColumns.filter((col) => !hiddenColumns.includes(col.key));

    return (
        <section>
            {effectiveShowTitle && <h2 className="text-xl font-bold mb-2 text-center">Estatísticas dos Jogadores</h2>}

            <div className="overflow-x-auto rounded-lg border bg-white shadow">
                <table className="table-auto w-full text-sm text-center">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            {columns.map((c) => {
                                const headerContent = (
                                    <div className="flex items-center justify-center gap-1">
                                        <span>{c.label}</span>
                                        <SortIcon active={sortKey === (c.key as keyof PlayerStats)} order={sortOrder} />
                                    </div>
                                );

                                return (
                                    <th
                                        key={c.key}
                                        onClick={() => handleSort(c.key as keyof PlayerStats)}
                                        className="px-3 py-2 cursor-pointer select-none hover:bg-gray-100"
                                        aria-sort={
                                            sortKey === (c.key as keyof PlayerStats)
                                                ? sortOrder === "asc"
                                                    ? "ascending"
                                                    : "descending"
                                                : "none"
                                        }
                                        scope="col"
                                    >
                                        {c.tooltip ? <Tooltip content={c.tooltip}>{headerContent}</Tooltip> : headerContent}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={columns.length} className="p-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-6" />
                                        <Skeleton className="h-6" />
                                        <Skeleton className="h-6" />
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading && pageItems.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="p-4 text-gray-600">
                                    Nenhum jogador encontrado.
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            pageItems.map((p) => {
                                const saves = Number(p.totalSaves || 0);
                                const conceded = clubGoalsAgainst;
                                const savePct = pct(saves, saves + conceded);

                                const isDisconnected = Boolean((p as any).disconnected);
                                const isMotm = Number(p.totalMom || 0) > 0;
                                const isGoalkeeper =
                                    ((p as any).position?.toUpperCase?.() === "GK") || saves > 0;
                                const hasRedCard = Number(p.totalRedCards || 0) > 0;

                                const showHighlights = p.matchesPlayed === 1;

                                const rowClass = showHighlights
                                    ? isDisconnected
                                        ? "bg-red-50 border-l-4 border-red-400"
                                        : isMotm
                                            ? "bg-amber-50 border-l-4 border-amber-400"
                                            : hasRedCard
                                                ? "bg-red-50 border-l-4 border-red-500"
                                                : ""
                                    : hasRedCard
                                        ? "bg-red-50"
                                        : "";

                                const Icons = showHighlights ? (
                                    <span className="inline-flex items-center gap-1 mr-2">
                                        {isDisconnected && (
                                            <Tooltip content="Desconectado">
                                                <PlugZap size={16} className="text-red-600" />
                                            </Tooltip>
                                        )}
                                        {isMotm && (
                                            <Tooltip content="Man of the Match">
                                                <Star size={16} className="text-amber-600" />
                                            </Tooltip>
                                        )}
                                        {isGoalkeeper && (
                                            <Tooltip content="Goleiro">
                                                <GiGoalKeeper size={16} className="text-blue-700" />
                                            </Tooltip>
                                        )}
                                        {hasRedCard && (
                                            <Tooltip content={`${int.format(p.totalRedCards)} Cartão${p.totalRedCards > 1 ? 'ões' : ''} Vermelho${p.totalRedCards > 1 ? 's' : ''}`}>
                                                <RectangleVertical size={16} className="text-red-700 fill-red-700" />
                                            </Tooltip>
                                        )}
                                    </span>
                                ) : hasRedCard ? (
                                    <span className="inline-flex items-center gap-1 mr-2">
                                        <Tooltip content={`${int.format(p.totalRedCards)} Cartão${p.totalRedCards > 1 ? 'ões' : ''} Vermelho${p.totalRedCards > 1 ? 's' : ''}`}>
                                            <RectangleVertical size={16} className="text-red-700 fill-red-700" />
                                        </Tooltip>
                                    </span>
                                ) : null;

                                const renderCell = (col: { key: string }) => {
                                    switch (col.key) {
                                        case "proName":
                                            return (
                                                <td
                                                    key={col.key}
                                                    className="px-3 py-2 font-medium text-left sticky left-0 bg-inherit"
                                                >
                                                    {Icons}
                                                    {p.proName}
                                                </td>
                                            );
                                        case "matchesPlayed":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.matchesPlayed)}
                                                </td>
                                            );
                                        case "totalGoals":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    <CellBar
                                                        value={p.totalGoals}
                                                        max={maxByKey.get("totalGoals") || 1}
                                                        format={(v) => int.format(v)}
                                                    />
                                                </td>
                                            );
                                        case "totalAssists":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    <CellBar
                                                        value={p.totalAssists}
                                                        max={maxByKey.get("totalAssists") || 1}
                                                        format={(v) => int.format(v)}
                                                    />
                                                </td>
                                            );
                                        case "totalPreAssists":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    <CellBar
                                                        value={p.totalPreAssists}
                                                        max={maxByKey.get("totalPreAssists") || 1}
                                                        format={(v) => int.format(v)}
                                                    />
                                                </td>
                                            );
                                        case "participations": {
                                            const participations = (Number(p.totalGoals) || 0) + (Number(p.totalAssists) || 0) + (Number(p.totalPreAssists) || 0);
                                            return (
                                                <td key={col.key} className="px-3 py-2 font-medium">
                                                    {int.format(participations)}
                                                </td>
                                            );
                                        }
                                        case "totalShots":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.totalGoals)} / {int.format(p.totalShots)}
                                                    <div className="mt-1">
                                                        <CellBar
                                                            value={p.goalAccuracyPercent}
                                                            max={100}
                                                            suffix="%"
                                                            positive
                                                            format={(v) => p1.format(v)}
                                                            statType="shotToGoalConversion"
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        case "totalSaves":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(saves)} / {int.format(conceded)}
                                                    <div className="mt-1">
                                                        <CellBar
                                                            value={savePct}
                                                            max={100}
                                                            suffix="%"
                                                            positive
                                                            format={(v) => p1.format(v)}
                                                            statType="savePercentage"
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        case "totalPassesMade":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.totalPassesMade)} / {int.format(p.totalPassAttempts)}
                                                    <div className="mt-1">
                                                        <CellBar
                                                            value={pct(p.totalPassesMade, p.totalPassAttempts)}
                                                            max={100}
                                                            suffix="%"
                                                            positive
                                                            format={(v) => p1.format(v)}
                                                            statType="passCompletion"
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        case "totalTacklesMade": {
                                            const tacklePct = pct(p.totalTacklesMade, p.totalTackleAttempts);
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.totalTacklesMade)} / {int.format(p.totalTackleAttempts)}
                                                    <div className="mt-1">
                                                        <CellBar
                                                            value={tacklePct}
                                                            max={100}
                                                            suffix="%"
                                                            positive
                                                            format={(v) => p1.format(v)}
                                                            statType="tackleDuelWin"
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        }
                                        case "record":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.totalWins)}/{int.format(p.totalDraws)}/{int.format(p.totalLosses)}
                                                </td>
                                            );
                                        case "winPercent":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    <CellBar
                                                        value={p.winPercent}
                                                        max={100}
                                                        suffix="%"
                                                        positive
                                                        format={(v) => p1.format(v)}
                                                        statType="winRate"
                                                    />
                                                </td>
                                            );
                                        case "totalMom":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {int.format(p.totalMom)}
                                                </td>
                                            );
                                        case "avgRating":
                                            return (
                                                <td key={col.key} className="px-3 py-2">
                                                    {p2.format(Number(p.avgRating || 0))}
                                                </td>
                                            );
                                        default:
                                            return null;
                                    }
                                };

                                return (
                                    <tr key={p.playerId} className={`hover:bg-gray-50 ${rowClass}`}>
                                        {columns.map((col) => renderCell(col))}
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {effectiveShowPagination && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-600">
                        Mostrando {pageItems.length} de {sorted.length} jogadores (pág. {page}/{totalPages})
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded border bg-white disabled:opacity-50"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            Anterior
                        </button>
                        <button
                            className="px-3 py-1 rounded border bg-white disabled:opacity-50"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
