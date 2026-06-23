// src/components/MultiClubPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { API_ENDPOINTS, crestUrl, FALLBACK_LOGO } from "../config/urls.ts";

type ClubListItem = {
    clubId: number;
    name: string;
    crestAssetId?: string | null;
};

export default function MultiClubPicker() {
    const { selectedClubs, setSelectedClubs } = useClub();

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

    const selectedIds = useMemo(
        () => new Set(selectedClubs.map((c) => c.clubId)),
        [selectedClubs]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? clubs.filter(c => c.name.toLowerCase().includes(q) || String(c.clubId).includes(q))
            : clubs;
        // selecionados aparecem no topo
        return [
            ...base.filter(c => selectedIds.has(c.clubId)),
            ...base.filter(c => !selectedIds.has(c.clubId)),
        ];
    }, [clubs, query, selectedIds]);

    function toggleClub(c: ClubListItem) {
        if (selectedIds.has(c.clubId)) {
            setSelectedClubs(selectedClubs.filter((x) => x.clubId !== c.clubId));
        } else {
            setSelectedClubs([
                ...selectedClubs,
                { clubId: c.clubId, clubName: c.name, crestAssetId: c.crestAssetId ?? null },
            ]);
        }
    }

    function clearAll() {
        setSelectedClubs([]);
    }

    return (
        <div className="relative" ref={containerRef}>
            {/* Botão trigger */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-slate-200 px-2 py-1 rounded border border-white/10 transition-colors"
                title={
                    selectedClubs.length > 0
                        ? selectedClubs.map((c) => c.clubName ?? c.clubId).join(", ")
                        : "Selecionar clubes"
                }
            >
                {selectedClubs.length > 0 ? (
                    <>
                        <div className="flex -space-x-1">
                            {selectedClubs.slice(0, 3).map((c) => (
                                <img
                                    key={c.clubId}
                                    src={crestUrl(c.crestAssetId)}
                                    onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO)}
                                    alt=""
                                    className="w-6 h-6 rounded-full border bg-surface"
                                />
                            ))}
                        </div>
                        <span className="font-semibold truncate max-w-[180px]">
                            {selectedClubs.length === 1
                                ? selectedClubs[0].clubName ?? selectedClubs[0].clubId
                                : `${selectedClubs.length} clubes`}
                        </span>
                    </>
                ) : (
                    <span className="font-semibold">Selecionar clubes</span>
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
                className={`absolute right-0 mt-2 w-96 bg-surface text-fg rounded-xl shadow-lg border z-50 origin-top transition-all duration-150 ${
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
                        className="w-full px-3 py-2 bg-surface-sunken border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent pr-8 text-sm"
                    />
                    {query && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted text-lg leading-none"
                            onClick={() => setQuery("")}
                            tabIndex={-1}
                        >
                            ×
                        </button>
                    )}
                </div>

                {loading && <div className="p-3 text-sm text-fg-muted">Carregando…</div>}
                {err && <div className="p-3 text-sm text-negative">{err}</div>}

                {!loading && !err && (
                    <>
                        <ul className="max-h-80 overflow-auto">
                            {filtered.length === 0 && (
                                <li className="p-3 text-sm text-fg-muted">Nenhum clube encontrado.</li>
                            )}
                            {filtered.map((c) => {
                                const checked = selectedIds.has(c.clubId);
                                return (
                                    <li
                                        key={c.clubId}
                                        className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors border-l-2 ${
                                            checked
                                                ? "bg-accent/10 border-l-accent"
                                                : "border-l-transparent hover:bg-surface-raised"
                                        }`}
                                        onClick={() => toggleClub(c)}
                                    >
                                        {/* Checkbox customizado */}
                                        <span
                                            className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                                checked ? "bg-accent border-accent" : "bg-surface border-border-strong"
                                            }`}
                                        >
                                            {checked && (
                                                <svg className="w-2.5 h-2.5 text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </span>
                                        <img
                                            src={crestUrl(c.crestAssetId)}
                                            onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO)}
                                            alt=""
                                            className="w-7 h-7 rounded-full border bg-surface flex-shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium leading-tight truncate text-sm text-fg">{c.name}</div>
                                            <div className="text-xs text-fg-muted">ID: {c.clubId}</div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Footer com contagem */}
                        <div className="p-2 border-t flex items-center justify-between">
                            <span className="text-xs text-fg-subtle">
                                {selectedClubs.length > 0
                                    ? `${selectedClubs.length} selecionado${selectedClubs.length !== 1 ? "s" : ""} de ${clubs.length}`
                                    : `${clubs.length} clube${clubs.length !== 1 ? "s" : ""}`}
                            </span>
                            <div className="flex items-center gap-2">
                                {selectedClubs.length > 0 && (
                                    <button
                                        className="text-sm px-2 py-1 rounded border text-negative hover:bg-negative-soft"
                                        onClick={clearAll}
                                    >
                                        Limpar
                                    </button>
                                )}
                                <button
                                    className="text-sm px-2 py-1 rounded border hover:bg-surface-raised"
                                    onClick={() => setOpen(false)}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
