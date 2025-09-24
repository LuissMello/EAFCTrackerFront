import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import MultiClubPicker from "./MultiClubPicker.tsx";
import { useClub } from "../hooks/useClub.tsx";
import api from "../services/api.ts";

type LastRunResponse = {
    lastFetchedAtUtc?: string | null;
};

export default function Navbar() {
    const { setClub } = useClub();
    const [searchParams, setSearchParams] = useSearchParams();

    // ===========================
    // Estado: seleção de clubes (já existente)
    // ===========================
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

    // ===========================
    // Estado: última busca global
    // ===========================
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

    React.useEffect(() => {
        fetchLastRun();
    }, [fetchLastRun]);

    const handleRunFetch = React.useCallback(async () => {
        try {
            setRunning(true);
            setError(null);
            await api.post("/api/fetch/run", {}); // sem body; endpoint dispara para todos os clubes e tipos
            await fetchLastRun();              // atualiza o carimbo ao concluir
        } catch (e: any) {
            const msg = e?.response?.data ?? e?.message ?? "Falha ao disparar busca";
            setError(typeof msg === "string" ? msg : "Erro inesperado ao buscar");
            console.error(e);
        } finally {
            setRunning(false);
        }
    }, [fetchLastRun]);

    const formatLastRun = (iso?: string | null) => {
        if (!iso) return "Nunca";
        const d = new Date(iso);
        // converte para horário de Brasília (America/Sao_Paulo)
        const br = d.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        return br; // ex.: "24/09 15:42:10"
    };

    const lastRunLabel = loadingLastRun ? "Carregando…" : formatLastRun(lastRunUtc);

    return (
        <nav className="bg-black text-white p-4 flex flex-wrap items-center gap-3">
            <Link className="font-bold" to="/">Partidas</Link>
            <Link className="font-bold" to="/stats">Estatísticas</Link>
            <Link className="font-bold" to="/calendar">Calendário</Link>
            <Link className="font-bold" to="/trends">Trends</Link>
            <Link className="font-bold" to="/attributes">Atributos</Link>

            <div className="ml-auto flex items-center gap-3">
                <MultiClubPicker value={groupIds} onChange={handleChange} />

                {/* Botão de busca manual */}
                <button
                    onClick={handleRunFetch}
                    disabled={running}
                    className={`px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition ${running ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                    title="Disparar coleta agora para todos os clubes configurados"
                >
                    {running ? "Buscando…" : "Buscar novas partidas"}
                </button>

                {/* Última busca */}
                <div className="text-xs text-gray-300">
                    Última busca:{" "}
                    <span
                        className="font-medium text-gray-100"
                        title={lastRunUtc ?? "Nunca executado"}
                    >
                        {lastRunLabel}
                    </span>
                </div>
            </div>

            {error && (
                <div className="w-full text-xs text-red-300 mt-1">
                    {error}
                </div>
            )}
        </nav>
    );
}
