import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

// ===== Tipos =====
export interface CalendarDaySummaryDto {
    date: string;
    matchesCount: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
}
export interface CalendarMonthDto {
    year: number;
    month: number;
    days: CalendarDaySummaryDto[];
}
export interface CalendarMatchStatLineDto {
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;
    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
    avgRating: number;
}
export interface CalendarMatchSummaryDto {
    matchId: number;
    timestamp: string;
    clubAId: number;
    clubAName: string;
    clubAGoals: number;
    clubACrestAssetId?: string | null;
    clubBId: number;
    clubBName: string;
    clubBGoals: number;
    clubBCrestAssetId?: string | null;
    resultForClub: "W" | "D" | "L" | "-";
    stats: CalendarMatchStatLineDto;
}
export interface CalendarDayDetailsDto {
    date: string;
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    matches: CalendarMatchSummaryDto[];
}

// ===== Helpers =====
const ptMonth = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const ptWeekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const ptDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYmd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};
function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, months: number) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
}
function getGridStart(date: Date) {
    const first = startOfMonth(date);
    const dow = (first.getDay() + 6) % 7; // 0 = segunda
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - dow);
    return gridStart;
}
const crestUrl = (id?: string | null) =>
    id
        ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
        : null;

// ===== UI =====
function ResultPill({ r }: { r: "W" | "D" | "L" | "-" }) {
    const map: Record<string, string> = {
        W: "bg-green-100 text-green-700 border-green-200",
        D: "bg-yellow-100 text-yellow-700 border-yellow-200",
        L: "bg-red-100 text-red-700 border-red-200",
        "-": "bg-gray-100 text-gray-600 border-gray-200",
    };
    const label = r === "W" ? "Vitória" : r === "D" ? "Empate" : r === "L" ? "Derrota" : "-";
    return <span className={`px-2 py-0.5 rounded-full text-xs border ${map[r]}`}>{label}</span>;
}
function Crest({ id, alt }: { id?: string | null; alt: string }) {
    const url = crestUrl(id);
    if (!url) return null;
    return (
        <img
            src={url}
            alt={alt}
            className="w-6 h-6 rounded-full bg-gray-100 object-contain"
            loading="lazy"
        />
    );
}
function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ===== Página =====
export default function CalendarPage() {
    const { club } = useClub();
    const clubId = club?.clubId ?? null;
    const clubName = club?.clubName ?? "";

    const [referenceMonth, setReferenceMonth] = useState<Date>(startOfMonth(new Date()));

    const [monthData, setMonthData] = useState<CalendarMonthDto | null>(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [errorMonth, setErrorMonth] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayData, setDayData] = useState<CalendarDayDetailsDto | null>(null);
    const [loadingDay, setLoadingDay] = useState(false);
    const [errorDay, setErrorDay] = useState<string | null>(null);

    const year = referenceMonth.getFullYear();
    const month1to12 = referenceMonth.getMonth() + 1;

    // Cabeçalhos SEG–DOM
    const weekdays = useMemo(() => {
        const base = new Date(2023, 0, 2); // segunda
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            return ptWeekday.format(d).toUpperCase();
        });
    }, []);

    // Grid 6 semanas
    const gridDays = useMemo(() => {
        const start = getGridStart(referenceMonth);
        const totalCells = 42;
        return Array.from({ length: totalCells }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [referenceMonth]);

    const summaryByDate: Record<string, CalendarDaySummaryDto> = useMemo(() => {
        const map: Record<string, CalendarDaySummaryDto> = {};
        for (const s of monthData?.days ?? []) map[s.date] = s;
        return map;
    }, [monthData]);

    const isSameMonth = (d: Date, ref: Date) =>
        d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

    // NOVO: sempre que trocar de clube OU mês, limpamos tudo para não mostrar dado antigo
    useEffect(() => {
        setMonthData(null);
        setErrorMonth(null);
        setSelectedDate(null);
        setDayData(null);
        setErrorDay(null);
    }, [clubId, year, month1to12]);

    // Buscar mês (com clubId)
    useEffect(() => {
        if (!clubId) return;
        let disposed = false;
        (async () => {
            setLoadingMonth(true);
            setErrorMonth(null);
            setMonthData(null); // NOVO: limpa antes de buscar
            try {
                const { data } = await api.get<CalendarMonthDto>(
                    "https://localhost:5000/api/Calendar",
                    { params: { year, month: month1to12, clubId } }
                );
                if (!disposed) setMonthData(data);
            } catch (err: any) {
                if (!disposed) setErrorMonth(err?.message ?? "Erro ao carregar calendário");
            } finally {
                if (!disposed) setLoadingMonth(false);
            }
        })();
        return () => { disposed = true; };
    }, [clubId, year, month1to12]);

    // Buscar dia (com clubId)
    useEffect(() => {
        if (!selectedDate || !clubId) return;
        let disposed = false;
        (async () => {
            setLoadingDay(true);
            setErrorDay(null);
            setDayData(null); // NOVO: limpa antes de buscar
            try {
                const { data } = await api.get<CalendarDayDetailsDto>(
                    "https://localhost:5000/api/Calendar/day",
                    { params: { date: selectedDate, clubId } }
                );
                if (!disposed) setDayData(data);
            } catch (err: any) {
                if (!disposed) setErrorDay(err?.message ?? "Erro ao carregar o dia");
            } finally {
                if (!disposed) setLoadingDay(false);
            }
        })();
        return () => { disposed = true; };
    }, [selectedDate, clubId]);

    if (!clubId) {
        return (
            <div className="p-4 max-w-6xl mx-auto">
                Defina um <b>clubId</b> no topo para visualizar o calendário.
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setReferenceMonth(addMonths(referenceMonth, -1))}
                        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                        aria-label="Mês anterior"
                    >
                        ◀
                    </button>
                    <button
                        onClick={() => setReferenceMonth(startOfMonth(new Date()))}
                        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => setReferenceMonth(addMonths(referenceMonth, 1))}
                        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                        aria-label="Próximo mês"
                    >
                        ▶
                    </button>
                    <h1 className="text-2xl font-bold ml-2">
                        {ptMonth.format(referenceMonth)} de {referenceMonth.getFullYear()}
                    </h1>
                </div>

                <div className="text-sm text-gray-600">
                    Clube atual:{" "}
                    <span className="font-semibold">
                        {clubName ? `${clubName} (${clubId})` : clubId}
                    </span>
                </div>
            </div>

            {/* Cabeçalhos dos dias da semana */}
            <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {weekdays.map((w) => (
                    <div key={w} className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {w}
                    </div>
                ))}
            </div>

            {/* Grid do mês */}
            <div className="grid grid-cols-7 gap-2">
                {gridDays.map((d) => {
                    const ymd = toYmd(d);
                    const summary = summaryByDate[ymd];
                    const inMonth = isSameMonth(d, referenceMonth);
                    return (
                        <button
                            key={ymd}
                            onClick={() => summary && setSelectedDate(ymd)}
                            className={`relative h-28 rounded-xl border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${inMonth ? "bg-white" : "bg-gray-50"
                                } ${summary ? "hover:shadow-md cursor-pointer" : "opacity-60 cursor-default"}`}
                            aria-disabled={!summary}
                            aria-label={`${ptDay.format(d)} ${ptMonth.format(d)} — ${summary ? `${summary.matchesCount} jogo(s)` : "sem jogos"
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <span className={`text-sm font-semibold ${inMonth ? "text-gray-900" : "text-gray-400"}`}>
                                    {ptDay.format(d)}
                                </span>
                                {loadingMonth && !monthData && <Skeleton className="w-8 h-4" />}
                            </div>

                            {summary && (
                                <div className="mt-2 space-y-1">
                                    <div className="text-xs text-gray-600">{summary.matchesCount} jogo(s)</div>
                                    <div className="flex items-center gap-1 text-[11px]">
                                        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">V {summary.wins}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">E {summary.draws}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">D {summary.losses}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-600">GP {summary.goalsFor} • GC {summary.goalsAgainst}</div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Estados */}
            {errorMonth && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{errorMonth}</div>
            )}
            {!loadingMonth && monthData && monthData.days.length === 0 && (
                <div className="mt-4 p-3 bg-gray-50 text-gray-700 rounded border">Sem jogos neste mês.</div>
            )}

            {/* Drawer do dia */}
            {selectedDate && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/30"
                        onClick={() => {
                            setSelectedDate(null);
                            setDayData(null);
                        }}
                    />
                    <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-xl p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    {ptDay.format(fromYmd(selectedDate))} {ptMonth.format(fromYmd(selectedDate))}
                                </h2>
                                {dayData && (
                                    <p className="text-sm text-gray-600">
                                        {dayData.totalMatches} jogo(s) • GP {dayData.goalsFor} • GC {dayData.goalsAgainst} •
                                        <span className="ml-1">V {dayData.wins}</span>
                                        <span className="ml-1">E {dayData.draws}</span>
                                        <span className="ml-1">D {dayData.losses}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                                onClick={() => {
                                    setSelectedDate(null);
                                    setDayData(null);
                                }}
                            >
                                Fechar
                            </button>
                        </div>

                        {loadingDay && (
                            <div className="space-y-3">
                                <Skeleton className="h-16" />
                                <Skeleton className="h-16" />
                                <Skeleton className="h-16" />
                            </div>
                        )}

                        {errorDay && <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{errorDay}</div>}

                        {!loadingDay && dayData && dayData.matches.length === 0 && (
                            <div className="p-3 bg-gray-50 text-gray-700 rounded border">Nenhuma partida neste dia.</div>
                        )}

                        {!loadingDay && dayData && dayData.matches.length > 0 && (
                            <div className="space-y-3">
                                {dayData.matches.map((m) => (
                                    <div key={m.matchId} className="border rounded-xl p-3 hover:shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Crest id={m.clubACrestAssetId} alt={m.clubAName} />
                                                <span className="font-medium">{m.clubAName}</span>
                                                <span className="font-semibold">{m.clubAGoals}</span>
                                                <span className="text-gray-400">x</span>
                                                <span className="font-semibold">{m.clubBGoals}</span>
                                                <span className="font-medium">{m.clubBName}</span>
                                                <Crest id={m.clubBCrestAssetId} alt={m.clubBName} />
                                            </div>
                                            <ResultPill r={m.resultForClub} />
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-700">
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Chutes</span>
                                                <span className="font-semibold">{m.stats.totalShots}</span>
                                            </div>
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Gols</span>
                                                <span className="font-semibold">{m.stats.totalGoals}</span>
                                            </div>
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Passes Certos</span>
                                                <span className="font-semibold">{m.stats.totalPassesMade}</span>
                                            </div>
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Passes (%)</span>
                                                <span className="font-semibold">{m.stats.passAccuracyPercent.toFixed(0)}%</span>
                                            </div>
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Desarmes (%)</span>
                                                <span className="font-semibold">{m.stats.tackleSuccessPercent.toFixed(0)}%</span>
                                            </div>
                                            <div className="bg-gray-50 rounded p-2 flex items-center justify-between">
                                                <span>Nota Média</span>
                                                <span className="font-semibold">{m.stats.avgRating.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-right">
                                            <Link to={`/match/${m.matchId}`} className="text-sm text-blue-700 hover:underline">
                                                Ver detalhes da partida
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
