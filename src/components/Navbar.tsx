import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import MultiClubPicker from "./MultiClubPicker.tsx";
import { useClub } from "../hooks/useClub.tsx";
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

    // se o backend devolver levemente no futuro por fuso, trata como agora
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 5 && diffSec > -5) return "agora";
    const abs = Math.abs(diffSec);

    for (const [unit, inSec] of UNITS) {
        const value = Math.floor(abs / inSec);
        if (value >= 1) {
            // passado => número negativo para "há X"
            return rtf.format(-value, unit);
        }
    }
    return rtf.format(-abs, "second");
}

export default function Navbar() {
    const { setClub } = useClub();
    const [searchParams, setSearchParams] = useSearchParams();

    // seleção de clubes (como já estava)
    const [groupIds, setGroupIds] = React.useState<number[]>(() => {
        const raw = searchParams.get("clubIds");
        if (raw) {
            const ids = raw.split(",").map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
            return ids;
        }
        const single = searchParams.get("clubId");
        if (single && !Number.isNaN(parseInt(single, 10))) return [parseInt(single, 10)];
        return [];
    });

    React.useEffect(() => {
        const raw = searchParams.get("clubIds");
        if (raw) {
            const ids = raw.split(",").map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
            setGroupIds(ids);
            return;
        }
        const single = searchParams.get("clubId");
        if (single && !Number.isNaN(parseInt(single, 10))) setGroupIds([parseInt(single, 10)]);
        else setGroupIds([]);
    }, [searchParams]);

    const handleChange = (ids: number[]) => {
        setGroupIds(ids);
        const next = new URLSearchParams(searchParams);
        if (ids.length) next.set("clubIds", ids.join(",")); else next.delete("clubIds");
        if (ids.length === 1) next.set("clubId", String(ids[0])); else next.delete("clubId");
        setSearchParams(next, { replace: true });

        if (ids.length === 1) setClub({ clubId: ids[0] });
        else setClub(null);
    };

    // última busca
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

    return (
        <nav className="bg-black text-white p-4">
            {/* Linha 1: links */}
            <div className="flex items-center gap-3 flex-wrap">
                <Link className="font-bold" to="/">Partidas</Link>
                <Link className="font-bold" to="/stats">Estatísticas</Link>
                <Link className="font-bold" to="/calendar">Calendário</Link>
                <Link className="font-bold" to="/statisticsbydate">Estatisticas (periodo)</Link>
                <Link className="font-bold" to="/trends">Trends</Link>
                <Link className="font-bold" to="/attributes">Atributos</Link>

                {/* Desktop (>=sm) */}
                <div className="ml-auto hidden sm:flex items-center gap-3">
                    <div className="relative w-80">
                        <MultiClubPicker value={groupIds} onChange={handleChange} />
                    </div>

                    <button
                        onClick={handleRunFetch}
                        disabled={running}
                        className={`px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition ${running ? "opacity-70 cursor-not-allowed" : ""}`}
                        title="Disparar coleta agora"
                    >
                        {running ? "Buscando…" : "Buscar novas partidas"}
                    </button>

                    <div className="text-xs text-gray-300">
                        Última busca: <span className="font-medium text-gray-100">{lastRunLabel}</span>
                    </div>
                </div>
            </div>

            {/* Mobile (<sm) */}
            <div className="mt-2 flex sm:hidden flex-col gap-2">
                <div className="relative w-full">
                    <MultiClubPicker value={groupIds} onChange={handleChange} />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRunFetch}
                        disabled={running}
                        className={`flex-1 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition ${running ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                        {running ? "Buscando…" : "Buscar novas partidas"}
                    </button>

                    <div className="text-[11px] text-gray-300 whitespace-nowrap">
                        Última busca: <span className="font-medium text-gray-100">{lastRunLabel}</span>
                    </div>
                </div>
            </div>

            {error && <div className="text-xs text-red-300 mt-1">{error}</div>}
        </nav>
    );
}
