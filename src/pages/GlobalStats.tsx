import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx"; // ✅ importa o hook correto (sem .tsx)

// ========================
// Tipos
// ========================
interface PlayerStats {
    playerId: number;
    playerName: string;
    clubId: number;
    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;
    avgRating: number;
    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
    winPercent: number;
}

interface ClubStats {
    clubId: number;
    clubName: string;
    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;
    avgRating: number;
    winPercent: number;
    passAccuracyPercent: number;
    goalAccuracyPercent: number;
}

type SortKey = keyof PlayerStats;
type SortOrder = "asc" | "desc";

// ========================
// Helpers
// ========================
const columns: Array<{ key: SortKey; label: string; tooltip?: string }> = [
    { key: "playerName", label: "Jogador" },
    { key: "matchesPlayed", label: "Partidas" },
    { key: "totalGoals", label: "Gols" },
    { key: "totalAssists", label: "Assistências" },
    { key: "totalShots", label: "Chutes (%)" },
    { key: "totalPassesMade", label: "Passes (C/T)" },
    { key: "totalTacklesMade", label: "Desarmes (C/T)" },
    { key: "totalWins", label: "Vitórias" },
    { key: "totalLosses", label: "Derrotas" },
    { key: "totalDraws", label: "Empates" },
    { key: "winPercent", label: "Win %" },
    { key: "totalRedCards", label: "Vermelhos" },
    { key: "totalMom", label: "MOM" },
    { key: "avgRating", label: "Nota" },
];

const percent = (made: number, attempts: number) =>
    attempts > 0 ? (made / attempts) * 100 : 0;

function downloadCSV(filename: string, rows: any[]) {
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const replacer = (_k: string, v: any) => (v ?? "") as string;
    const csv = [
        header.join(","),
        ...rows.map((row) => header.map((f) => JSON.stringify(row[f], replacer)).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
    if (!active) return <span className="opacity-30">↕</span>;
    return <span>{order === "asc" ? "▲" : "▼"}</span>;
}

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ========================
// Componente principal
// ========================
export default function PlayerStatisticsPage() {
    const { club } = useClub();                   // ✅ pega o objeto club
    const clubId = club?.clubId;                  // ✅ extrai o id
    const clubName = club?.clubName;              // opcional

    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [clubStats, setClubStats] = useState<ClubStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [matchCount, setMatchCount] = useState<number>(10);
    const [minMatches, setMinMatches] = useState<number>(1);
    const [search, setSearch] = useState("");

    const [sortKey, setSortKey] = useState<SortKey>("totalGoals");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

    const [page, setPage] = useState(1);
    const pageSize = 20;

    async function fetchStats(count: number) {
        if (!clubId) {
            // sem clubId: limpa e sai
            setPlayers([]);
            setClubStats(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // use sua baseURL do axios se preferir: api.get("/api/Matches/statistics/limited", { params: { count, clubId } })
            const { data } = await api.get(
                "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/statistics/limited",
                { params: { count, clubId } } // ✅ envia clubId
            );

            setPlayers(data.players ?? []);
            setClubStats(data.clubs?.[0] ?? null);
        } catch (err: any) {
            setError(err?.message ?? "Erro ao buscar estatísticas.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchStats(matchCount);
    }, [clubId, matchCount]); // ✅ refaz a busca quando o clubId mudar

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortOrder("desc");
        }
    }

    // Filtros e ordenação
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return players
            .filter((p) => p.matchesPlayed >= minMatches)
            .filter((p) => (term ? p.playerName.toLowerCase().includes(term) : true));
    }, [players, minMatches, search]);

    const sorted = useMemo(() => {
        const cp = [...filtered];
        cp.sort((a, b) => {
            const va = a[sortKey] as any;
            const vb = b[sortKey] as any;
            if (typeof va === "number" && typeof vb === "number") {
                return sortOrder === "asc" ? va - vb : vb - va;
            }
            const sa = String(va);
            const sb = String(vb);
            return sortOrder === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        return cp;
    }, [filtered, sortKey, sortOrder]);

    // Paginação
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page]);

    useEffect(() => {
        setPage(1);
    }, [minMatches, search, sortKey, sortOrder]);

    // Mensagem se não houver clubId definido
    if (!clubId) {
        return (
            <div className="p-4 sm:p-6">
                Defina um <b>clubId</b> no topo para ver as estatísticas.
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-[98vw] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">Estatísticas</h1>
                <div className="text-sm text-gray-600">
                    Clube atual:{" "}
                    <span className="font-semibold">
                        {clubName ? `${clubName} (${clubId})` : clubId}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex flex-col">
                        <label htmlFor="matchCount" className="text-sm text-gray-600">Últimas partidas</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="matchCount"
                                type="number"
                                min={1}
                                value={matchCount}
                                onChange={(e) => setMatchCount(Math.max(1, Number(e.target.value) || 1))}
                                className="border rounded-lg px-3 py-2 w-28"
                            />
                            <button
                                onClick={() => fetchStats(matchCount)}
                                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Atualizar
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label htmlFor="minMatches" className="text-sm text-gray-600">Min. partidas</label>
                        <input
                            id="minMatches"
                            type="number"
                            min={1}
                            value={minMatches}
                            onChange={(e) => setMinMatches(Math.max(1, Number(e.target.value) || 1))}
                            className="border rounded-lg px-3 py-2 w-28"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label htmlFor="search" className="text-sm text-gray-600">Buscar jogador</label>
                        <input
                            id="search"
                            type="text"
                            placeholder="Nome do jogador"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="border rounded-lg px-3 py-2 w-56"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => downloadCSV("players.csv", sorted)}
                        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                    >
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Cartão do Clube */}
            <section className="mb-6">
                {loading && !clubStats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </div>
                )}

                {clubStats && (
                    <div className="overflow-x-auto">
                        <table className="table-auto w-full border border-gray-200 text-sm text-center bg-white rounded-lg shadow">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2">Clube</th>
                                    <th className="px-3 py-2">Gols</th>
                                    <th className="px-3 py-2">Assistências</th>
                                    <th className="px-3 py-2">Chutes / Precisão</th>
                                    <th className="px-3 py-2">Passes (C/T)</th>
                                    <th className="px-3 py-2">Desarmes (C/T)</th>
                                    <th className="px-3 py-2">Vitórias / %</th>
                                    <th className="px-3 py-2">Empates</th>
                                    <th className="px-3 py-2">Derrotas</th>
                                    <th className="px-3 py-2">Vermelhos</th>
                                    <th className="px-3 py-2">MOM</th>
                                    <th className="px-3 py-2">Nota Média</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-semibold">{clubStats.clubName}</td>
                                    <td className="px-3 py-2">{clubStats.totalGoals}</td>
                                    <td className="px-3 py-2">{clubStats.totalAssists}</td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalShots} / {clubStats.goalAccuracyPercent.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalPassesMade} / {clubStats.totalPassAttempts} (
                                        {percent(clubStats.totalPassesMade, clubStats.totalPassAttempts).toFixed(1)}%)
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalTacklesMade} / {clubStats.totalTackleAttempts} (
                                        {percent(clubStats.totalTacklesMade, clubStats.totalTackleAttempts).toFixed(1)}%)
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalWins} / {Number(clubStats.winPercent).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2">{clubStats.totalDraws}</td>
                                    <td className="px-3 py-2">{clubStats.totalLosses}</td>
                                    <td className="px-3 py-2">{clubStats.totalRedCards}</td>
                                    <td className="px-3 py-2">{clubStats.totalMom}</td>
                                    <td className="px-3 py-2">{Number(clubStats.avgRating).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && !clubStats && !error && (
                    <div className="p-3 bg-gray-50 rounded border text-gray-700">
                        Sem estatísticas de clube disponíveis.
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-red-50 rounded border border-red-200 text-red-700">
                        {error}
                    </div>
                )}
            </section>

            {/* Tabela de jogadores */}
            <section>
                <h2 className="text-xl font-bold mb-2 text-center">Estatísticas dos Jogadores</h2>
                <div className="overflow-x-auto">
                    <table className="table-auto w-full border border-gray-200 text-sm text-center bg-white rounded-lg shadow">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {columns.map((c) => (
                                    <th
                                        key={c.key as string}
                                        onClick={() => handleSort(c.key)}
                                        className="px-3 py-2 cursor-pointer select-none hover:bg-gray-100"
                                        title={c.tooltip}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <span>{c.label}</span>
                                            <SortIcon active={sortKey === c.key} order={sortOrder} />
                                        </div>
                                    </th>
                                ))}
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
                                pageItems.map((p) => (
                                    <tr key={p.playerId} className="hover:bg-gray-50">
                                        {/* IMPORTANTE: sua rota atual é /statistics/player/:matchId/:playerId.
                       Como aqui não temos matchId, mantive sem Link para evitar 404.
                       Se você criar uma rota /statistics/player/:playerId, pode envolver com <Link> aqui. */}
                                        <td className="px-3 py-2 font-medium text-left">{p.playerName}</td>
                                        <td className="px-3 py-2">{p.matchesPlayed}</td>
                                        <td className="px-3 py-2">{p.totalGoals}</td>
                                        <td className="px-3 py-2">{p.totalAssists}</td>
                                        <td className="px-3 py-2">
                                            {p.totalShots} / {p.goalAccuracyPercent.toFixed(1)}%
                                        </td>
                                        <td className="px-3 py-2">
                                            {p.totalPassesMade} / {p.totalPassAttempts} (
                                            {percent(p.totalPassesMade, p.totalPassAttempts).toFixed(1)}%)
                                        </td>
                                        <td className="px-3 py-2">
                                            {p.totalTacklesMade} / {p.totalTackleAttempts} (
                                            {percent(p.totalTacklesMade, p.totalTackleAttempts).toFixed(1)}%)
                                        </td>
                                        <td className="px-3 py-2">{p.totalWins}</td>
                                        <td className="px-3 py-2">{p.totalLosses}</td>
                                        <td className="px-3 py-2">{p.totalDraws}</td>
                                        <td className="px-3 py-2">{p.winPercent.toFixed(1)}%</td>
                                        <td className="px-3 py-2">{p.totalRedCards}</td>
                                        <td className="px-3 py-2">{p.totalMom}</td>
                                        <td className="px-3 py-2">{p.avgRating.toFixed(2)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="mt-3 flex items-center justify-between">
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
            </section>
        </div>
    );
}
