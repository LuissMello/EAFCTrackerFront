import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { API_ENDPOINTS, crestUrl, FALLBACK_LOGO } from "../config/urls.ts";

type ClubListItem = {
    clubId: number;
    name: string;
    crestAssetId?: string | null;
};

export default function ClubPicker() {
    const { club, setClub } = useClub();
    const [open, setOpen] = useState(false);
    const [clubs, setClubs] = useState<ClubListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    // fecha ao clicar fora
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // carrega lista de clubes do backend
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const { data } = await api.get<ClubListItem[]>(API_ENDPOINTS.CLUBS);
                if (!cancel) setClubs(data ?? []);
            } catch (e: any) {
                if (!cancel) setErr(e?.message ?? "Erro ao carregar clubes");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return clubs;
        return clubs.filter(c =>
            c.name.toLowerCase().includes(q) || String(c.clubId).includes(q)
        );
    }, [clubs, query]);

    const selectClub = (c: ClubListItem) => {
        setClub({
            clubId: c.clubId,
            clubName: c.name,
            crestAssetId: c.crestAssetId ?? null
        });
        setOpen(false);
    };


    const clearClub = () => setClub(null);

    return (
        <div className="relative" ref={ref}>
            {/* Botão atual */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 bg-white text-blue-600 px-2 py-1 rounded"
                title={club?.clubName || (club?.clubId ? String(club.clubId) : "Selecionar clube")}
            >
                {club?.clubId ? (
                    <>
                        {/* badge do clube atual */}
                        <img
                            src={club?.crestAssetId ? crestUrl(club.crestAssetId) : FALLBACK_LOGO}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO; }}
                            alt="Escudo"
                            className="w-6 h-6 rounded-full bg-white border"
                        />
                        <span className="font-semibold truncate max-w-[160px]">
                            {club.clubName ?? club.clubId}
                        </span>
                    </>
                ) : (
                    <span className="font-semibold">Selecionar clube</span>
                )}
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="opacity-80">
                    <path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-black rounded-xl shadow-lg border z-50">
                    <div className="p-2 border-b">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar por nome ou ID…"
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                        />
                    </div>

                    {loading && <div className="p-3 text-sm">Carregando…</div>}
                    {err && <div className="p-3 text-sm text-red-600">{err}</div>}

                    {!loading && !err && (
                        <ul className="max-h-72 overflow-auto">
                            {filtered.length === 0 && (
                                <li className="p-3 text-sm text-gray-600">Nenhum clube encontrado.</li>
                            )}
                            {filtered.map(c => (
                                <li
                                    key={c.clubId}
                                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                    onClick={() => selectClub(c)}
                                >
                                    <img
                                        src={crestUrl(c.crestAssetId)}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO; }}
                                        alt=""
                                        className="w-7 h-7 rounded-full border bg-white"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium leading-tight truncate">{c.name}</div>
                                        <div className="text-xs text-gray-500">ID: {c.clubId}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="p-2 border-t flex items-center justify-between">
                        <button
                            className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => setOpen(false)}
                        >
                            Fechar
                        </button>
                        {club?.clubId && (
                            <button
                                className="text-sm px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                onClick={clearClub}
                            >
                                Limpar seleção
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
