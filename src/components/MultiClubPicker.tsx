// src/components/MultiClubPicker.tsx
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useClub } from "../hooks/useClub.tsx";
import type { ClubListItem } from "../hooks/useClub.tsx";
import { crestUrl, onImgError } from "../config/urls.ts";
import { gameVersionLabel } from "../hooks/useGameVersions.tsx";
import { GameVersionBadge } from "./GameVersionBadge.tsx";

export default function MultiClubPicker({ compact = false, dense = false }: { compact?: boolean; dense?: boolean }) {
    const { selectedClubs, setSelectedClubs, allClubs, clubsLoading, clubsError, reloadClubs } = useClub();
    const clubs = allClubs;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    /** Filtro de versão do jogo (26 = FC26); null = todas */
    const [versionFilter, setVersionFilter] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const panelId = useId();

    const close = useCallback((returnFocus = false) => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    }, []);

    // fecha ao clicar fora (só enquanto aberto)
    useEffect(() => {
        if (!open) return;
        function onDocClick(e: PointerEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("pointerdown", onDocClick);
        return () => document.removeEventListener("pointerdown", onDocClick);
    }, [open]);

    // fecha com Escape (só enquanto aberto)
    useEffect(() => {
        if (!open) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") close(true);
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, close]);

    // autofocus na busca ao abrir
    useEffect(() => {
        if (open) {
            const t = setTimeout(() => searchRef.current?.focus(), 50);
            return () => clearTimeout(t);
        }
        setQuery("");
    }, [open]);

    const selectedIds = useMemo(
        () => new Set(selectedClubs.map((c) => c.clubId)),
        [selectedClubs]
    );

    // Versões presentes entre os clubes, mais nova primeiro
    const versionsPresent = useMemo(() => {
        const set = new Set<number>();
        clubs.forEach((c) => {
            if (typeof c.gameVersion === "number") set.add(c.gameVersion);
        });
        return Array.from(set).sort((a, b) => b - a);
    }, [clubs]);
    // Se a versão filtrada deixou de existir (clube removido/alterado), volta para "Todas"
    const activeVersion = versionFilter !== null && versionsPresent.includes(versionFilter) ? versionFilter : null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const byVersion = activeVersion === null ? clubs : clubs.filter((c) => c.gameVersion === activeVersion);
        const base = q
            ? byVersion.filter(c => (c.name ?? "").toLowerCase().includes(q) || String(c.clubId).includes(q))
            : byVersion;
        // selecionados aparecem no topo
        return [
            ...base.filter(c => selectedIds.has(c.clubId)),
            ...base.filter(c => !selectedIds.has(c.clubId)),
        ];
    }, [clubs, query, selectedIds, activeVersion]);

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

    function focusOption(i: number) {
        const max = filtered.length - 1;
        if (max < 0) return;
        const idx = Math.max(0, Math.min(max, i));
        optionRefs.current[idx]?.focus();
    }

    function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            focusOption(0);
        }
    }

    function onOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(index + 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                if (index === 0) searchRef.current?.focus();
                else focusOption(index - 1);
                break;
            case "Home":
                e.preventDefault();
                focusOption(0);
                break;
            case "End":
                e.preventDefault();
                focusOption(filtered.length - 1);
                break;
            default:
                break;
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            {/* Botão trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={panelId}
                className={`flex items-center gap-2 bg-white/10 hover:bg-white/15 text-slate-200 px-2 rounded border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                    compact ? "w-full min-w-0 h-11 text-sm" : dense ? "h-7 py-0 text-[13px]" : "py-1"
                }`}
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
                                    onError={onImgError}
                                    alt=""
                                    className={`${dense ? "w-5 h-5" : "w-6 h-6"} rounded-full border bg-surface`}
                                />
                            ))}
                        </div>
                        <span className={`font-semibold truncate ${compact ? "min-w-0 flex-1 text-left" : "max-w-[180px]"}`}>
                            {selectedClubs.length === 1
                                ? selectedClubs[0].clubName ?? selectedClubs[0].clubId
                                : `${selectedClubs.length} clubes`}
                        </span>
                    </>
                ) : (
                    <span className={`font-semibold ${compact ? "min-w-0 flex-1 truncate text-left" : ""}`}>Selecionar clubes</span>
                )}
                <svg
                    width="16" height="16" viewBox="0 0 20 20" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                    aria-hidden="true"
                    className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                >
                    <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
                </svg>
            </button>

            {/* Dropdown — sempre montado para animação; "invisible" remove do foco/leitores quando fechado */}
            <div
                id={panelId}
                aria-hidden={!open}
                className={`${
                    compact
                        ? "fixed inset-x-2 top-[calc(var(--nav-h,56px)+4px)] w-auto max-w-none sm:left-auto sm:right-2 sm:w-96"
                        : "absolute left-0 mt-2 w-full sm:w-96 max-w-[24rem]"
                } bg-surface text-fg rounded-xl shadow-raised border z-50 origin-top transition-all duration-150 ${
                    open ? "opacity-100 scale-100 pointer-events-auto visible" : "opacity-0 scale-95 pointer-events-none invisible"
                }`}
            >
                {/* Busca */}
                <div className="p-2 border-b relative">
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Buscar por nome ou ID…"
                        aria-label="Buscar clube por nome ou ID"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent pr-8 text-sm bg-surface-sunken"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="Limpar busca"
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted text-lg leading-none"
                            onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                        >
                            ×
                        </button>
                    )}
                </div>

                {versionsPresent.length > 0 && (
                    <div role="group" aria-label="Filtrar por versão do jogo" className="px-2 py-1.5 border-b flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-fg-muted mr-0.5">Versão:</span>
                        {[null, ...versionsPresent].map((v) => (
                            <button
                                key={v ?? "all"}
                                type="button"
                                aria-pressed={activeVersion === v}
                                onClick={() => setVersionFilter(v)}
                                className={`px-2 py-0.5 rounded-full border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                    activeVersion === v
                                        ? "bg-accent border-accent text-accent-fg"
                                        : "bg-surface text-fg-muted hover:bg-surface-raised"
                                }`}
                            >
                                {v === null ? "Todas" : gameVersionLabel(v)}
                            </button>
                        ))}
                    </div>
                )}

                {clubsLoading && <div className="p-3 text-sm text-fg-muted">Carregando…</div>}
                {clubsError && (
                    <div className="p-3 text-sm text-negative flex items-center justify-between gap-2">
                        <span>{clubsError}</span>
                        <button
                            type="button"
                            className="text-sm px-2 py-1 rounded border hover:bg-negative-soft"
                            onClick={reloadClubs}
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}

                {!clubsLoading && !clubsError && (
                    <>
                        <ul
                            role="listbox"
                            aria-multiselectable="true"
                            aria-label="Clubes"
                            className={compact ? "max-h-[min(20rem,calc(100dvh-14rem))] overflow-auto" : "max-h-80 overflow-auto"}
                        >
                            {filtered.length === 0 && (
                                <li role="presentation" className="p-3 text-sm text-fg-muted">Nenhum clube encontrado.</li>
                            )}
                            {filtered.map((c, idx) => {
                                const checked = selectedIds.has(c.clubId);
                                return (
                                    <li key={c.clubId} role="presentation">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={checked}
                                            ref={(el) => { optionRefs.current[idx] = el; }}
                                            onKeyDown={(e) => onOptionKeyDown(e, idx)}
                                            onClick={() => toggleClub(c)}
                                            className={`w-full text-left px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors border-l-2 focus-visible:outline-none focus-visible:bg-surface-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                                                checked
                                                    ? "bg-accent/10 border-l-accent"
                                                    : "border-l-transparent hover:bg-surface-raised"
                                            }`}
                                        >
                                            {/* Checkbox customizado */}
                                            <span
                                                aria-hidden="true"
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
                                                onError={onImgError}
                                                alt=""
                                                className="w-7 h-7 rounded-full border bg-surface flex-shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium leading-tight truncate text-sm text-fg">{c.name}</div>
                                                <div className="text-xs text-fg-muted flex items-center gap-1.5">
                                                    <span>ID: {c.clubId}</span>
                                                    <GameVersionBadge version={c.gameVersion} />
                                                </div>
                                            </div>
                                        </button>
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
                                        type="button"
                                        className="text-sm px-2 py-1 rounded border text-negative hover:bg-negative-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-negative"
                                        onClick={clearAll}
                                    >
                                        Limpar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="text-sm px-2 py-1 rounded border hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    onClick={() => close(true)}
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
