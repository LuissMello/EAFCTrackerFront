import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, CalendarDays, ArrowUpRight } from "lucide-react";
import api from "../services/api.ts";
import { PlayerStatsTable } from "./PlayerStatsTable.tsx";
import { Skeleton } from "./ui.tsx";
import type { PlayerStats } from "../types/stats";

type DayDto = {
    date: string;
    statistics?: {
        overall?: {
            totalMatches?: number;
            totalWins?: number;
            totalDraws?: number;
            totalLosses?: number;
        };
        players?: PlayerStats[];
        clubs?: Array<{
            goalsFor?: number;
            GoalsFor?: number;
            goalsAgainst?: number;
            GoalsAgainst?: number;
        }>;
    };
};

const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function fmtYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}

const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

function labelForDate(iso: string): string {
    if (!iso || iso.length < 10) return iso ?? "—";
    const today = fmtYYYYMMDD(new Date());
    const key = iso.slice(0, 10);
    if (key === today) return "Hoje";
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return Number.isFinite(date.getTime()) ? dayFmt.format(date) : key;
}

/**
 * Painel recolhível na Home com o último dia que aparece em /statisticsbydate —
 * um "como está o seu dia" sem precisar navegar e rolar até o final.
 */
export default function LatestDayPanel({ clubIds }: { clubIds: number[] }) {
    const [day, setDay] = useState<DayDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const clubIdsKey = clubIds.join(",");

    useEffect(() => {
        let disposed = false;

        async function run() {
            if (!clubIds.length) {
                setDay(null);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const now = new Date();
                const start = new Date();
                start.setDate(now.getDate() - 120);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // fim do mês atual
                const params = {
                    clubIds: clubIdsKey,
                    start: fmtYYYYMMDD(start),
                    end: fmtYYYYMMDD(end),
                };
                const { data } = await api.get<DayDto[]>(
                    "/api/Clubs/matches/statistics/by-date-range-grouped",
                    { params }
                );
                const arr = (Array.isArray(data) ? data : []).slice();
                arr.sort((a, b) => String(b.date).localeCompare(String(a.date)));
                if (!disposed) setDay(arr[0] ?? null);
            } catch (e: any) {
                if (!disposed) setError("Falha ao carregar o dia");
            } finally {
                if (!disposed) setLoading(false);
            }
        }

        run();
        return () => {
            disposed = true;
        };
    }, [clubIdsKey, clubIds.length]);

    if (!clubIds.length) return null;
    if (loading && !day) {
        return (
            <div className="rounded-2xl border border-border bg-surface shadow-card">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-2.5 w-28" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
            </div>
        );
    }
    if (error || !day) return null;

    const ov = day.statistics?.overall ?? {};
    const players = day.statistics?.players ?? [];
    const wins = toNum(ov.totalWins);
    const draws = toNum(ov.totalDraws);
    const losses = toNum(ov.totalLosses);
    const matches = toNum(ov.totalMatches) || wins + draws + losses;
    const clubsArr = day.statistics?.clubs ?? [];
    const gf = clubsArr.reduce((a, c: any) => a + toNum(c?.goalsFor ?? c?.GoalsFor), 0);
    const ga = clubsArr.reduce((a, c: any) => a + toNum(c?.goalsAgainst ?? c?.GoalsAgainst), 0);

    const statsHref = `/statisticsbydate?clubIds=${encodeURIComponent(clubIdsKey)}`;

    return (
        <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition"
            >
                <span className="inline-flex w-9 h-9 rounded-lg bg-accent/10 text-accent items-center justify-center shrink-0">
                    <CalendarDays size={18} />
                </span>

                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
                        Acompanhamento do dia
                    </div>
                    <div className="font-display font-bold text-lg uppercase tracking-wide leading-none text-fg">
                        {labelForDate(day.date)}
                    </div>
                </div>

                {/* Resumo (V/E/D + gols) */}
                <div className="ml-auto flex items-center gap-3 sm:gap-4">
                    <div className="hidden sm:flex items-center gap-2.5 text-sm font-semibold tabular-nums">
                        <span className="text-positive">{wins}V</span>
                        <span className="text-warning">{draws}E</span>
                        <span className="text-negative">{losses}D</span>
                    </div>
                    <div className="hidden md:flex items-center gap-1 text-xs text-fg-muted whitespace-nowrap">
                        <span className="tabular-nums">{matches}</span> jogos
                        <span className="text-fg-subtle mx-0.5">·</span>
                        <span className="tabular-nums text-fg-secondary font-medium">
                            {gf}:{ga}
                        </span>
                    </div>
                    <ChevronDown
                        size={20}
                        className={`text-fg-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
                    />
                </div>
            </button>

            {open && (
                <div className="border-t border-border p-3 sm:p-4">
                    {/* resumo V/E/D visível no mobile (onde fica escondido no cabeçalho) */}
                    <div className="sm:hidden flex items-center gap-3 text-sm font-semibold tabular-nums mb-3">
                        <span className="text-positive">{wins}V</span>
                        <span className="text-warning">{draws}E</span>
                        <span className="text-negative">{losses}D</span>
                        <span className="text-fg-subtle">·</span>
                        <span className="text-fg-secondary">{gf}:{ga}</span>
                    </div>

                    {players.length > 0 ? (
                        <PlayerStatsTable
                            players={players}
                            loading={false}
                            error={null}
                            clubStats={null}
                            compactMode
                            hiddenColumns={["totalSecondsPlayed"]}
                        />
                    ) : (
                        <div className="text-sm text-fg-muted py-2">Sem partidas registradas neste dia.</div>
                    )}

                    <div className="mt-3 flex justify-end">
                        <Link
                            to={statsHref}
                            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                        >
                            Ver por período <ArrowUpRight size={15} />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
