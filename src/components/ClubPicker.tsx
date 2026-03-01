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
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // fecha ao clicar fora
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    // fecha com Escape
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    // autofocus na busca ao abrir
    useEffect(() => {
        if (open) {
            setTimeout(() => searchRef.current?.focus(), 50);
        } else {
            setQuery("");
        }
    }, [open]);

    // carrega lista de clubes
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
        const base = q
            ? clubs.filter(c => c.name.toLowerCase().includes(q) || String(c.clubId).includes(q))
            : clubs;
        // clube selecionado aparece primeiro
        if (club?.clubId) {
            return [
                ...base.filter(c => c.clubId === club.clubId),
                ...base.filter(c => c.clubId !== club.clubId),
            ];
        }
        return base;
    }, [clubs, query, club?.clubId]);

    const selectClub = (c: ClubListItem) => {
        setClub({ clubId: c.clubId, clubName: c.name, crestAssetId: c.crestAssetId ?? null });
        setOpen(false);
    };

    const clearClub = () => setClub(null);

    return (
        <div className="relative" ref={containerRef}>
            {/* Botão trigger */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 bg-white text-blue-600 px-2 py-1 rounded"
                title={club?.clubName || (club?.clubId ? String(club.clubId) : "Selecionar clube")}
            >
                {club?.clubId ? (
                    <>
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
                <svg
                    width="16" height="16" viewBox="0 0 20 20" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                    className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                >
                    <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
                </svg>
            </button>

            {/* Dropdown — sempre montado para animação */}
            <div
                className={`absolute right-0 mt-2 w-80 bg-white text-black rounded-xl shadow-lg border z-50 origin-top transition-all duration-150 ${
                    open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                }`}
            >
                {/* Busca */}
                <div className="p-2 border-b relative">
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nome ou ID…"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 pr-8 text-sm"
                    />
                    {query && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                            onClick={() => setQuery("")}
                            tabIndex={-1}
                        >
                            ×
                        </button>
                    )}
                </div>

                {loading && <div className="p-3 text-sm text-gray-500">Carregando…</div>}
                {err && <div className="p-3 text-sm text-red-600">{err}</div>}

                {!loading && !err && (
                    <ul className="max-h-72 overflow-auto">
                        {filtered.length === 0 && (
                            <li className="p-3 text-sm text-gray-600">Nenhum clube encontrado.</li>
                        )}
                        {filtered.map(c => {
                            const isSelected = club?.clubId === c.clubId;
                            return (
                                <li
                                    key={c.clubId}
                                    className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors border-l-2 ${
                                        isSelected
                                            ? "bg-blue-50 border-l-blue-500"
                                            : "border-l-transparent hover:bg-blue-50"
                                    }`}
                                    onClick={() => selectClub(c)}
                                >
                                    <img
                                        src={crestUrl(c.crestAssetId)}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO; }}
                                        alt=""
                                        className="w-7 h-7 rounded-full border bg-white flex-shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium leading-tight truncate text-sm">{c.name}</div>
                                        <div className="text-xs text-gray-500">ID: {c.clubId}</div>
                                    </div>
                                    {isSelected && (
                                        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* Footer */}
                <div className="p-2 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                        {clubs.length > 0 ? `${clubs.length} clube${clubs.length !== 1 ? "s" : ""}` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        {club?.clubId && (
                            <button
                                className="text-sm px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                onClick={clearClub}
                            >
                                Limpar
                            </button>
                        )}
                        <button
                            className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                            onClick={() => setOpen(false)}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
