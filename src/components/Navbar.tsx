import React from "react";
import { Link, useLocation } from "react-router-dom";
import MultiClubPicker from "./MultiClubPicker.tsx";
import api from "../services/api.ts";

type LastRunResponse = { lastFetchedAtUtc?: string | null };
type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const UNITS: [Unit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
];

function formatTimeAgo(iso?: string | null): string {
    if (!iso) return "Nunca";
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 5 && diffSec > -5) return "agora";
    const abs = Math.abs(diffSec);
    for (const [unit, inSec] of UNITS) {
        const value = Math.floor(abs / inSec);
        if (value >= 1) return rtf.format(-value, unit);
    }
    return rtf.format(-abs, "second");
}

function freshnessDot(iso?: string | null): string {
    if (!iso) return "bg-red-400";
    const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diffMin < 30) return "bg-green-400";
    if (diffMin < 120) return "bg-amber-400";
    return "bg-red-400";
}

const NAV_LINKS = [
    { to: "/", label: "Partidas" },
    { to: "/stats", label: "Estatísticas" },
    { to: "/calendar", label: "Calendário" },
    { to: "/statisticsbydate", label: "Stats Período" },
    { to: "/singlestatisticsbydate", label: "Stats Individuais" },
    { to: "/trends", label: "Trends" },
    { to: "/attributes", label: "Atributos" },
];

function Spinner() {
    return (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
    );
}

export default function Navbar() {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = React.useState(false);

    const [lastRunUtc, setLastRunUtc] = React.useState<string | null>(null);
    const [loadingLastRun, setLoadingLastRun] = React.useState<boolean>(true);
    const [running, setRunning] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    const fetchLastRun = React.useCallback(async () => {
        try {
            setLoadingLastRun(true);
            setError(null);
            const { data } = await api.get<LastRunResponse>("/api/fetch/last-run");
            setLastRunUtc(data?.lastFetchedAtUtc ?? null);
        } catch (e: any) {
            setError("Falha ao obter última busca");
            console.error(e);
        } finally {
            setLoadingLastRun(false);
        }
    }, []);

    React.useEffect(() => { fetchLastRun(); }, [fetchLastRun]);

    const [, forceTick] = React.useState(0);
    React.useEffect(() => {
        const id = setInterval(() => forceTick(t => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const handleRunFetch = React.useCallback(async () => {
        try {
            setRunning(true);
            setError(null);
            await api.post("/api/fetch/run", {});
            await fetchLastRun();
        } catch (e: any) {
            const msg = e?.response?.data ?? e?.message ?? "Falha ao disparar busca";
            setError(typeof msg === "string" ? msg : "Erro inesperado ao buscar");
            console.error(e);
        } finally {
            setRunning(false);
        }
    }, [fetchLastRun]);

    const lastRunLabel = loadingLastRun ? "Carregando…" : formatTimeAgo(lastRunUtc);
    const dotClass = loadingLastRun ? "bg-gray-500" : freshnessDot(lastRunUtc);

    const isActive = (to: string) =>
        to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

    const fetchBtn = (fullWidth = false) => (
        <button
            onClick={handleRunFetch}
            disabled={running}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                fullWidth ? "flex-1" : ""
            } ${
                running
                    ? "bg-white/10 text-gray-300 cursor-not-allowed"
                    : "bg-white text-black hover:bg-gray-100"
            }`}
            title="Disparar coleta agora"
        >
            {running ? <><Spinner /> Buscando…</> : "Buscar partidas"}
        </button>
    );

    const lastRunInfo = (small = false) => (
        <div className={`flex items-center gap-1.5 ${small ? "text-[11px]" : "text-xs"} text-gray-300 whitespace-nowrap`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span>
                Última busca: <span className="font-medium text-gray-100">{lastRunLabel}</span>
            </span>
        </div>
    );

    return (
        <nav className="bg-black text-white px-5 py-2.5">
            {/* Barra principal */}
            <div className="flex items-center gap-2">
                {/* Logo */}
                <span className="font-bold text-sm tracking-tight whitespace-nowrap">EAFC Tracker</span>
                <span className="hidden sm:block w-px h-4 bg-white/25 flex-shrink-0 mx-1" />

                {/* Links — ocultos no mobile */}
                <div className="hidden sm:flex items-center gap-0.5 flex-wrap">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`px-2.5 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                                isActive(to)
                                    ? "bg-white/15 text-white border-b-2 border-white"
                                    : "text-gray-300 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Hambúrguer (mobile only) */}
                <button
                    className="sm:hidden p-1 rounded hover:bg-white/10 transition ml-1"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Menu"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        {menuOpen
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        }
                    </svg>
                </button>

                {/* Controles desktop */}
                <div className="ml-auto hidden sm:flex items-center gap-3">
                    <span className="w-px h-4 bg-white/25 flex-shrink-0" />
                    <div className="relative w-80">
                        <MultiClubPicker />
                    </div>
                    {fetchBtn()}
                    {lastRunInfo()}
                </div>
            </div>

            {/* Dropdown mobile */}
            {menuOpen && (
                <div className="sm:hidden mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            onClick={() => setMenuOpen(false)}
                            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                isActive(to)
                                    ? "bg-white/15 text-white"
                                    : "text-gray-300 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            {label}
                        </Link>
                    ))}

                    <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
                        <div className="relative w-full">
                            <MultiClubPicker />
                        </div>
                        <div className="flex items-center gap-2">
                            {fetchBtn(true)}
                            {lastRunInfo(true)}
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs bg-red-900/40 rounded px-2 py-1 text-red-200">
                    ⚠️ {error}
                </div>
            )}
        </nav>
    );
}
