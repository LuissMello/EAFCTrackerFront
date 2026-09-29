import React, { useCallback, useEffect, useMemo, useRef, useState, useId, KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { API_ENDPOINTS, crestUrl, onImgError } from "../config/urls.ts";
import { parseTimestamp, toYmd } from "../utils/date.ts";
import { useAuth } from "../hooks/useAuth.tsx";

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
    timeZoneId: string;
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    matches: CalendarMatchSummaryDto[];
    sessions: { id: number; startedAt: string; endedAt: string; matchIds: number[] }[];
}

// ===== Helpers =====
const ptMonth = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const ptWeekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const ptDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fromYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, months: number) { return new Date(d.getFullYear(), d.getMonth() + months, 1); }
function addDays(d: Date, days: number) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
function getGridStart(date: Date) { const first = startOfMonth(date); const dow = (first.getDay() + 6) % 7; const gridStart = new Date(first); gridStart.setDate(first.getDate() - dow); return gridStart; }
function getWeekStart(d: Date) { const dow = (d.getDay() + 6) % 7; const ws = new Date(d); ws.setDate(d.getDate() - dow); return new Date(ws.getFullYear(), ws.getMonth(), ws.getDate()); }

// ===== UI =====
function ResultPill({ r }: { r: "W" | "D" | "L" | "-" }) {
    const map: Record<string, string> = {
        W: "bg-positive-soft text-positive-fg border-positive/30",
        D: "bg-warning-soft text-warning-fg border-warning/30",
        L: "bg-negative-soft text-negative-fg border-negative/30",
        "-": "bg-surface-sunken text-fg-muted border-border",
    };
    const label = r === "W" ? "Vitória" : r === "D" ? "Empate" : r === "L" ? "Derrota" : "-";
    return <span className={`px-2 py-0.5 rounded-full text-xs border ${map[r]}`}>{label}</span>;
}
function Crest({ id, alt }: { id?: string | null; alt: string }) {
    const url = crestUrl(id);
    if (!url) return <div className="w-6 h-6 rounded-full bg-surface-sunken" aria-hidden />;
    return (
        <img src={url} alt={alt} onError={onImgError} className="w-6 h-6 rounded-full bg-surface-sunken object-contain" loading="lazy" decoding="async" />
    );
}
function Skeleton({ className = "" }: { className?: string }) { return <div className={`animate-pulse bg-surface-sunken rounded ${className}`} />; }


// ===== Página =====
type ViewMode = "monthly" | "weekly";

export default function CalendarPage() {
    const { club } = useClub();
    const { isAdmin } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // 🔹 Suporta seleção múltipla via URL (?clubIds=1,2,3) OU um único via context (?clubId)
    const urlClubIds = searchParams.get("clubIds");
    const parsedClubIds = useMemo(
        () => (urlClubIds ? urlClubIds.split(",").map(s => parseInt(s, 10)).filter(n => Number.isFinite(n)) : []),
        [urlClubIds]
    );
    const singleClubId = club?.clubId ?? null;
    const clubKey = parsedClubIds.length
        ? parsedClubIds.join(",")
        : (singleClubId ? String(singleClubId) : null); // usado como dependência estável
    const selectedClubIds = useMemo(() => (clubKey ? clubKey.split(",").map(Number) : []), [clubKey]);
    const hasAnyClub = selectedClubIds.length > 0;

    const clubName = club?.clubName ?? "";
    const headerLabel = hasAnyClub
        ? (selectedClubIds.length === 1 ? `${clubName || selectedClubIds[0]} (${selectedClubIds[0]})` : `${selectedClubIds.length} clubes`)
        : "-";

    // Estado de visualização
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [groupingMode, setGroupingMode] = useState<"sessions" | "calendar">("sessions");
    const showSessions = groupingMode === "sessions" && selectedClubIds.length === 1;

    // Âncoras de navegação
    const [referenceMonth, setReferenceMonth] = useState<Date>(startOfMonth(new Date()));
    const [referenceWeekStart, setReferenceWeekStart] = useState<Date>(getWeekStart(new Date()));

    // Dados / estados
    const [monthData, setMonthData] = useState<CalendarMonthDto | null>(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [errorMonth, setErrorMonth] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayData, setDayData] = useState<CalendarDayDetailsDto | null>(null);
    const [loadingDay, setLoadingDay] = useState(false);
    const [errorDay, setErrorDay] = useState<string | null>(null);

    const [lastActiveButton, setLastActiveButton] = useState<HTMLButtonElement | null>(null);
    const dialogTitleId = useId();

    const monthCacheRef = useRef<Record<string, CalendarMonthDto>>({});
    const dayCacheRef = useRef<Record<string, CalendarDayDetailsDto>>({});

    // "Atualizar"/"Tentar novamente": invalida os caches de mês e dia e recarrega
    const [reloadKey, setReloadKey] = useState(0);
    const refreshCalendar = useCallback(() => {
        monthCacheRef.current = {};
        dayCacheRef.current = {};
        setReloadKey((k) => k + 1);
    }, []);

    const changeBoundary = async (matchId: number, mode: "auto" | "split" | "join") => {
        if (selectedClubIds.length !== 1) return;
        try {
            await api.put(API_ENDPOINTS.ADMIN_SESSION_BOUNDARY(selectedClubIds[0], matchId), { mode });
            refreshCalendar();
        } catch {
            setErrorDay("Não foi possível ajustar esta sessão.");
        }
    };

    // "Atualizar"/modo ao vivo do cabeçalho: mesmo efeito do botão local (limpa caches e recarrega)
    const { refreshKey: globalRefreshKey } = useRefresh();
    const seenGlobalRefreshRef = useRef(globalRefreshKey);
    useEffect(() => {
        if (seenGlobalRefreshRef.current === globalRefreshKey) return;
        seenGlobalRefreshRef.current = globalRefreshKey;
        refreshCalendar();
    }, [globalRefreshKey, refreshCalendar]);

    const pageRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const legendRef = useRef<HTMLDivElement | null>(null);
    const [gridHeight, setGridHeight] = useState<number>(520);

    const year = referenceMonth.getFullYear();
    const month1to12 = referenceMonth.getMonth() + 1;

    const todayYmd = toYmd(new Date());

    const weekdays = useMemo(() => {
        const base = new Date(2023, 0, 2);
        return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return ptWeekday.format(d).toUpperCase(); });
    }, []);

    const gridDays = useMemo(() => {
        if (viewMode === "monthly") {
            const start = getGridStart(referenceMonth);
            const totalCells = 42;
            return Array.from({ length: totalCells }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
        }
        return Array.from({ length: 7 }, (_, i) => addDays(referenceWeekStart, i));
    }, [referenceMonth, referenceWeekStart, viewMode]);

    const summaryByDate: Record<string, CalendarDaySummaryDto> = useMemo(() => {
        const map: Record<string, CalendarDaySummaryDto> = {};
        for (const s of monthData?.days ?? []) map[s.date] = s;
        return map;
    }, [monthData]);

    const isSameMonth = (d: Date, ref: Date) => d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

    useEffect(() => {
        setErrorMonth(null);
        setSelectedDate(null);
        setDayData(null);
        setErrorDay(null);
    }, [clubKey, year, month1to12]);

    useEffect(() => {
        function recompute() {
            const vh = window.innerHeight;
            const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
            const legendH = legendRef.current?.getBoundingClientRect().height ?? 0;
            const paddingY = 32;
            const guard = 8;
            const available = Math.max(280, Math.floor(vh - headerH - legendH - paddingY - guard));
            setGridHeight(available);
        }
        recompute();
        window.addEventListener("resize", recompute);
        return () => window.removeEventListener("resize", recompute);
    }, [viewMode]);

    // ===== Ler do URL no mount =====
    const didInitFromUrlRef = useRef(false);
    useEffect(() => {
        if (didInitFromUrlRef.current) return;
        didInitFromUrlRef.current = true;

        const modeParam = searchParams.get("mode");
        if (searchParams.get("grouping") === "calendar") setGroupingMode("calendar");
        const ymYear = Number(searchParams.get("year"));
        const ymMonth = Number(searchParams.get("month"));
        const weekStartParam = searchParams.get("weekStart");
        const dateParam = searchParams.get("date");

        if (modeParam === "weekly" || modeParam === "monthly") {
            setViewMode(modeParam);
        }

        if (modeParam === "weekly" && weekStartParam) {
            const ws = fromYmd(weekStartParam);
            const norm = getWeekStart(ws);
            setReferenceWeekStart(norm);
            setReferenceMonth(startOfMonth(norm));
        } else if (Number.isFinite(ymYear) && Number.isFinite(ymMonth) && ymYear && ymMonth) {
            const m = new Date(ymYear, ymMonth - 1, 1);
            setReferenceMonth(startOfMonth(m));
            setReferenceWeekStart(getWeekStart(m));
        }

        if (dateParam) setSelectedDate(dateParam);
    }, [searchParams]);

    // ===== Escrever no URL quando estado muda (preservando clubIds / clubId) =====
    useEffect(() => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("mode", viewMode);
        next.set("grouping", groupingMode);

        if (viewMode === "monthly") {
            next.set("year", String(referenceMonth.getFullYear()));
            next.set("month", String(referenceMonth.getMonth() + 1));
            next.delete("weekStart");
        } else {
            next.set("weekStart", toYmd(referenceWeekStart));
            next.delete("year");
            next.delete("month");
        }

        if (selectedDate) next.set("date", selectedDate);
        else next.delete("date");

        const prevStr = searchParams.toString();
        const nextStr = next.toString();
        if (prevStr !== nextStr) setSearchParams(next, { replace: true });
    }, [viewMode, groupingMode, referenceMonth, referenceWeekStart, selectedDate, searchParams, setSearchParams]);

    // ===== Buscar mês (com cache) + prefetch =====
    useEffect(() => {
        if (!clubKey) return;
        const controller = new AbortController();
        const { signal } = controller;
        const ids = clubKey.split(",").map(Number);

        async function fetchMonth(y: number, m: number, write = true) {
            const k = `${y}-${pad(m)}|${clubKey}|${showSessions}`;
            const cached = monthCacheRef.current[k];
            if (cached) {
                if (!signal.aborted && write) { setMonthData(cached); setLoadingMonth(false); }
                return;
            }
            if (write) { setLoadingMonth(true); setErrorMonth(null); setMonthData(null); }
            try {
                const params: any = { year: y, month: m, sessions: showSessions };
                if (ids.length > 1) params.clubIds = clubKey;
                else params.clubId = ids[0];

                const { data } = await api.get<CalendarMonthDto>(
                    API_ENDPOINTS.CALENDAR,
                    { params, signal }
                );
                if (signal.aborted) return;
                monthCacheRef.current[k] = data;
                if (write) setMonthData(data);
            } catch (err: any) {
                if (signal.aborted || isCanceled(err)) return;
                if (write) setErrorMonth(err?.message ?? "Erro ao carregar calendário");
            } finally {
                if (!signal.aborted && write) setLoadingMonth(false);
            }
        }

        fetchMonth(year, month1to12, true);
        const prev = new Date(year, month1to12 - 2, 1); fetchMonth(prev.getFullYear(), prev.getMonth() + 1, false);
        const next = new Date(year, month1to12, 1); fetchMonth(next.getFullYear(), next.getMonth() + 1, false);

        return () => controller.abort();
    }, [clubKey, year, month1to12, showSessions, reloadKey]);

    // ===== Buscar dia (com cache) =====
    useEffect(() => {
        if (!selectedDate || !clubKey) return;
        const controller = new AbortController();
        const { signal } = controller;
        const ids = clubKey.split(",").map(Number);

        async function run() {
            const cacheKey = `${selectedDate}|${clubKey}|${showSessions}`;
            const cached = dayCacheRef.current[cacheKey];
            if (cached) { if (!signal.aborted) { setDayData(cached); setLoadingDay(false); } return; }

            setLoadingDay(true); setErrorDay(null); setDayData(null);
            try {
                const params: any = { date: selectedDate, sessions: showSessions };
                if (ids.length > 1) params.clubIds = clubKey;
                else params.clubId = ids[0];

                const { data } = await api.get<CalendarDayDetailsDto>(
                    API_ENDPOINTS.CALENDAR_DAY,
                    { params, signal }
                );
                if (signal.aborted) return;
                dayCacheRef.current[cacheKey] = data;
                setDayData(data);
            } catch (err: any) {
                if (signal.aborted || isCanceled(err)) return;
                setErrorDay(err?.message ?? "Erro ao carregar o dia");
            } finally {
                if (!signal.aborted) setLoadingDay(false);
            }
        }
        run();
        return () => controller.abort();
    }, [selectedDate, clubKey, showSessions, reloadKey]);

    // Navegação por teclado
    function handleKeyNav(e: KeyboardEvent<HTMLDivElement>) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (viewMode === "monthly") setReferenceMonth(addMonths(referenceMonth, -1));
            else {
                const newStart = addDays(referenceWeekStart, -7);
                setReferenceWeekStart(newStart);
                setReferenceMonth(startOfMonth(newStart));
            }
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            if (viewMode === "monthly") setReferenceMonth(addMonths(referenceMonth, 1));
            else {
                const newStart = addDays(referenceWeekStart, 7);
                setReferenceWeekStart(newStart);
                setReferenceMonth(startOfMonth(newStart));
            }
        } else if (e.key.toLowerCase() === "t") {
            const today = new Date();
            setReferenceMonth(startOfMonth(today));
            setReferenceWeekStart(getWeekStart(today));
        } else if (e.key.toLowerCase() === "m") {
            setViewMode("monthly");
        } else if (e.key.toLowerCase() === "s") {
            setViewMode("weekly");
        }
    }

    // Título da semana
    const weekTitle = useMemo(() => {
        const start = referenceWeekStart; const end = addDays(start, 6);
        const sameMonthYear = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
        if (sameMonthYear) return `${ptDay.format(start)}–${ptDay.format(end)} de ${ptMonth.format(start)} de ${start.getFullYear()}`;
        return `${ptDay.format(start)} ${ptMonth.format(start)} ${start.getFullYear()} – ${ptDay.format(end)} ${ptMonth.format(end)} ${end.getFullYear()}`;
    }, [referenceWeekStart]);

    function cellTone(summary?: CalendarDaySummaryDto) {
        if (!summary || summary.matchesCount <= 0) return "";
        const { wins, draws, losses } = summary;
        if (wins > losses && wins > draws) return "bg-positive-soft";
        if (losses > wins && losses > draws) return "bg-negative-soft";
        if (draws > 0 && draws >= wins && draws >= losses) return "bg-warning-soft";
        return "bg-accent/10";
    }

    const ROWS = viewMode === "monthly" ? 6 : 1;
    const rowGapPx = (ROWS - 1) * 8;
    const minRow = viewMode === "monthly" ? 56 : 88;
    const rowHeight = Math.max(minRow, Math.floor((gridHeight - rowGapPx) / ROWS));

    return (
        <div ref={pageRef} className="p-4 max-w-6xl mx-auto min-h-[100dvh]" onKeyDown={handleKeyNav} aria-live="polite">
            {/* Header */}
            <div ref={headerRef} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <button onClick={() => { if (viewMode === "monthly") setReferenceMonth(addMonths(referenceMonth, -1)); else { const newStart = addDays(referenceWeekStart, -7); setReferenceWeekStart(newStart); setReferenceMonth(startOfMonth(newStart)); } }} className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised" aria-label={viewMode === "monthly" ? "Mês anterior" : "Semana anterior"}>◀</button>
                    <button onClick={() => { const today = new Date(); setReferenceMonth(startOfMonth(today)); setReferenceWeekStart(getWeekStart(today)); }} className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised">Hoje</button>
                    <button type="button" onClick={refreshCalendar} className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised" title="Recarregar dados (ignora o cache)">Atualizar</button>
                    <button onClick={() => { if (viewMode === "monthly") setReferenceMonth(addMonths(referenceMonth, 1)); else { const newStart = addDays(referenceWeekStart, 7); setReferenceWeekStart(newStart); setReferenceMonth(startOfMonth(newStart)); } }} className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised" aria-label={viewMode === "monthly" ? "Próximo mês" : "Próxima semana"}>▶</button>

                    <h1 className="text-2xl font-display font-bold uppercase tracking-wide text-fg ml-2">{viewMode === "monthly" ? `${ptMonth.format(referenceMonth)} de ${referenceMonth.getFullYear()}` : `Semana: ${weekTitle}`}</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-sm text-fg-muted">
                        Clube atual: <span className="font-semibold">{headerLabel}</span>
                    </div>
                    <div role="tablist" aria-label="Modo de visualização" className="inline-flex rounded-lg border overflow-hidden">
                        <button role="tab" aria-selected={viewMode === "monthly"} onClick={() => setViewMode("monthly")} className={`px-3 py-1.5 text-sm ${viewMode === "monthly" ? "bg-accent text-accent-fg" : "bg-surface text-fg-secondary hover:bg-surface-raised"}`}>Mensal</button>
                        <button role="tab" aria-selected={viewMode === "weekly"} onClick={() => setViewMode("weekly")} className={`px-3 py-1.5 text-sm border-l ${viewMode === "weekly" ? "bg-accent text-accent-fg" : "bg-surface text-fg-secondary hover:bg-surface-raised"}`}>Semanal</button>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="text-fg-muted">Organizar por:</span>
                <button type="button" aria-pressed={showSessions} disabled={selectedClubIds.length !== 1}
                    onClick={() => setGroupingMode("sessions")}
                    className={`px-3 py-1.5 rounded-lg border ${showSessions ? "bg-accent text-accent-fg" : "bg-surface"} disabled:opacity-50`}>
                    Sessões
                </button>
                <button type="button" aria-pressed={!showSessions} onClick={() => setGroupingMode("calendar")}
                    className={`px-3 py-1.5 rounded-lg border ${!showSessions ? "bg-accent text-accent-fg" : "bg-surface"}`}>
                    Dias do calendário
                </button>
                {selectedClubIds.length > 1 && <span className="text-xs text-fg-muted">Selecione um clube para ver sessões.</span>}
            </div>

            {/* Aviso quando não há clube definido */}
            {!hasAnyClub && (
                <div className="p-4 bg-warning-soft border border-warning/30 rounded text-warning-fg">
                    Defina um <b>clubId</b> ou <b>clubIds</b> no topo para visualizar o calendário.
                </div>
            )}

            {/* Legenda/ajuda */}
            <div ref={legendRef} className="flex items-center gap-3 text-xs text-fg-muted mt-3 mb-2">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/70" />{showSessions ? "Partidas da sessão" : "Partidas no dia"}</span>
                <span className="px-1 rounded bg-positive-soft text-positive-fg">V</span>
                <span className="px-1 rounded bg-warning-soft text-warning-fg">E</span>
                <span className="px-1 rounded bg-negative-soft text-negative-fg">D</span>
                <span className="ml-auto">Atalhos: ← → navegar • T hoje • M mensal • S semanal</span>
            </div>

            {/* Cabeçalhos dos dias da semana */}
            <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {weekdays.map((w) => (<div key={w} className="text-[11px] sm:text-xs font-semibold text-fg-muted uppercase tracking-wide">{w}</div>))}
            </div>

            {/* Grid */}
            <div role="grid" aria-label={viewMode === "monthly" ? "Calendário mensal" : "Calendário semanal"} className="grid grid-cols-7 gap-2" style={{ height: gridHeight, gridAutoRows: `${rowHeight}px` }}>
                {gridDays.map((d) => {
                    const ymd = toYmd(d);
                    const summary = summaryByDate[ymd];
                    const inMonth = isSameMonth(d, referenceMonth);
                    const isToday = ymd === todayYmd;
                    const disabled = !summary || !hasAnyClub;

                    return (
                        <button
                            key={ymd}
                            onClick={(e) => { if (disabled) return; setSelectedDate(ymd); setLastActiveButton(e.currentTarget); }}
                            className={[
                                "relative border p-1 sm:p-2 rounded-xl transition focus:outline-none h-full",
                                selectedDate === ymd
                                    ? "bg-accent/10"
                                    : viewMode === "monthly"
                                    ? (inMonth ? (summary ? cellTone(summary) : "bg-surface") : "bg-surface-raised")
                                    : (summary ? cellTone(summary) : "bg-surface"),
                                disabled ? "opacity-60 cursor-default" : "hover:shadow-md cursor-pointer",
                                selectedDate === ymd ? "ring-2 ring-accent" : isToday ? "ring-2 ring-accent/60" : "",
                                "overflow-hidden w-full flex flex-col"
                            ].join(" ")}
                            aria-disabled={disabled}
                            aria-pressed={selectedDate === ymd}
                            aria-label={`${ptDay.format(d)} ${ptMonth.format(d)} - ${summary ? `${summary.matchesCount} jogo(s)` : "sem jogos"}`}
                            title={summary ? `${summary.matchesCount} jogo(s)` : "Sem jogos"}
                        >
                            <div className="flex items-start justify-between min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className={`font-semibold ${inMonth ? "text-fg" : "text-fg-subtle"} text-xs sm:text-sm`}>
                                        {ptDay.format(d)}
                                    </span>
                                    {isToday && (
                                        <span className="text-[8px] sm:text-[9px] font-bold text-accent leading-none uppercase tracking-wide">Hoje</span>
                                    )}
                                </div>
                                {loadingMonth && !monthData && <Skeleton className="w-6 sm:w-8 h-3 sm:h-4" />}
                            </div>

                            {summary && hasAnyClub && (
                                <div className="flex-1 flex flex-col justify-center gap-0.5 px-0.5 mt-1">
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="px-1 rounded bg-positive-soft text-positive-fg text-[9px] sm:text-[10px]">V {summary.wins}</span>
                                        <span className="px-1 rounded bg-warning-soft text-warning-fg text-[9px] sm:text-[10px]">E {summary.draws}</span>
                                        <span className="px-1 rounded bg-negative-soft text-negative-fg text-[9px] sm:text-[10px]">D {summary.losses}</span>
                                    </div>
                                    <div className={`text-[8px] sm:text-[9px] text-fg-muted text-center ${viewMode === "weekly" ? "block" : "hidden sm:block"}`}>
                                        GP {summary.goalsFor} · GC {summary.goalsAgainst}
                                    </div>
                                    {viewMode === "weekly" && (
                                        <div className="text-[9px] sm:text-[10px] text-center font-semibold">
                                            <span className={summary.goalsFor >= summary.goalsAgainst ? "text-positive" : "text-negative"}>
                                                {summary.goalsFor - summary.goalsAgainst >= 0 ? "+" : ""}{summary.goalsFor - summary.goalsAgainst}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Estados */}
            {errorMonth && (
                <div className="mt-4 p-3 bg-negative-soft text-negative-fg rounded border border-negative/30 flex items-center justify-between">
                    <span>{errorMonth}</span>
                    <button type="button" className="btn btn-secondary px-2 py-1" onClick={refreshCalendar}>
                        Tentar novamente
                    </button>
                </div>
            )}
            {!loadingMonth && monthData && monthData.days.length === 0 && (
                <div className="mt-4 p-3 bg-surface-raised text-fg-secondary rounded border">Sem jogos neste mês.</div>
            )}

            {/* Drawer do dia */}
            {selectedDate && (
                <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
                    <div className="absolute inset-0 bg-black/30" onClick={() => { setSelectedDate(null); setDayData(null); lastActiveButton?.focus(); }} />
                    <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-surface shadow-xl p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 id={dialogTitleId} className="text-xl font-semibold">{showSessions ? "Sessões de " : ""}{ptDay.format(fromYmd(selectedDate))} {ptMonth.format(fromYmd(selectedDate))}</h2>
                                {dayData && (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                        <span className="text-sm text-fg-muted">{dayData.totalMatches} jogo(s)</span>
                                        <span className="text-fg-subtle">·</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-positive-soft text-positive-fg border border-positive/30">V {dayData.wins}</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning-fg border border-warning/30">E {dayData.draws}</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-negative-soft text-negative-fg border border-negative/30">D {dayData.losses}</span>
                                        <span className="text-fg-subtle">·</span>
                                        <span className="text-xs text-fg-muted">GP {dayData.goalsFor} · GC {dayData.goalsAgainst}</span>
                                    </div>
                                )}
                            </div>
                            <button className="px-3 py-2 rounded-lg border hover:bg-surface-raised" onClick={() => { setSelectedDate(null); setDayData(null); lastActiveButton?.focus(); }}>Fechar</button>
                        </div>

                        {loadingDay && (<div className="space-y-3" aria-live="polite"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>)}

                        {errorDay && (
                            <div className="p-3 bg-negative-soft text-negative-fg rounded border border-negative/30 flex items-center justify-between">
                                <span>{errorDay}</span>
                                <button type="button" className="btn btn-secondary px-2 py-1" onClick={refreshCalendar}>
                                    Tentar novamente
                                </button>
                            </div>
                        )}

                        {!loadingDay && dayData && dayData.matches.length === 0 && (<div className="p-3 bg-surface-raised text-fg-secondary rounded border">Nenhuma partida neste dia.</div>)}

                        {!loadingDay && dayData && dayData.matches.length > 0 && (
                            <div className="space-y-3">
                                {dayData.matches.map((m) => {
                                    const kickoffDate = parseTimestamp(m.timestamp);
                                    const timeZone = showSessions ? dayData.timeZoneId : undefined;
                                    const kickoff = kickoffDate ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone }).format(kickoffDate) : "";
                                    const session = showSessions ? dayData.sessions?.find(s => s.matchIds[0] === m.matchId) : undefined;
                                    const aWon = m.clubAGoals > m.clubBGoals;
                                    const bWon = m.clubBGoals > m.clubAGoals;
                                    const resultBorder =
                                        m.resultForClub === "W" ? "border-l-4 border-l-positive"
                                        : m.resultForClub === "L" ? "border-l-4 border-l-negative"
                                        : m.resultForClub === "D" ? "border-l-4 border-l-warning"
                                        : "";
                                    return (
                                        <div key={m.matchId}>
                                        {session && <div className="text-sm font-semibold text-fg mt-4 mb-2">Sessão {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone }).format(parseTimestamp(session.startedAt) ?? new Date(session.startedAt))} – {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone }).format(parseTimestamp(session.endedAt) ?? new Date(session.endedAt))}</div>}
                                        <div className={`border rounded-xl p-3 hover:shadow ${resultBorder}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Crest id={m.clubACrestAssetId} alt={m.clubAName} />
                                                    <span className="font-medium truncate max-w-[34%]" title={m.clubAName}>{m.clubAName}</span>
                                                    <span className={`font-semibold ${aWon ? "text-positive" : bWon ? "text-negative" : ""}`}>{m.clubAGoals}</span>
                                                    <span className="text-fg-subtle">–</span>
                                                    <span className={`font-semibold ${bWon ? "text-positive" : aWon ? "text-negative" : ""}`}>{m.clubBGoals}</span>
                                                    <span className="font-medium truncate max-w-[34%]" title={m.clubBName}>{m.clubBName}</span>
                                                    <Crest id={m.clubBCrestAssetId} alt={m.clubBName} />
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {kickoff && <span className="text-xs text-fg-muted">{kickoff}</span>}
                                                    <ResultPill r={m.resultForClub} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-fg-secondary">
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between"><span>Chutes</span><span className="font-semibold">{m.stats.totalShots}</span></div>
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between"><span>Gols</span><span className="font-semibold">{m.stats.totalGoals}</span></div>
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between"><span>Passes Certos</span><span className="font-semibold">{m.stats.totalPassesMade}</span></div>
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between"><span>Passes (%)</span><span className="font-semibold">{m.stats.passAccuracyPercent.toFixed(0)}%</span></div>
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between"><span>Desarmes (%)</span><span className="font-semibold">{m.stats.tackleSuccessPercent.toFixed(0)}%</span></div>
                                                <div className="bg-surface-raised rounded p-2 flex items-center justify-between border border-border"><span className="font-medium">Nota Média</span><span className="font-bold">{m.stats.avgRating.toFixed(2)}</span></div>
                                            </div>

                                            <div className="mt-2 flex justify-end">
                                                {isAdmin && showSessions && (
                                                    <div className="flex gap-1 mr-auto">
                                                        <button type="button" className="text-xs underline" onClick={() => changeBoundary(m.matchId, session ? "join" : "split")}>{session ? "Unir à anterior" : "Separar aqui"}</button>
                                                        <button type="button" className="text-xs underline text-fg-muted" onClick={() => changeBoundary(m.matchId, "auto")}>Automático</button>
                                                    </div>
                                                )}
                                                <Link
                                                    to={`/match/${m.matchId}`}
                                                    className="inline-flex items-center gap-1 text-xs border rounded-lg px-3 py-1.5 bg-surface hover:bg-surface-raised text-fg-secondary shadow-sm"
                                                >
                                                    Ver detalhes →
                                                </Link>
                                            </div>
                                        </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
