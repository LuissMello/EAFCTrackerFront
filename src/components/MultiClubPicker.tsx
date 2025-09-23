// src/components/MultiClubPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

type ClubListItem = {
    clubId: number;
    name: string;
    crestAssetId?: string | null;
};

const CLUBS_URL = "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs";
const FALLBACK_LOGO = "https://via.placeholder.com/28?text=%E2%9A%BD";
const crestUrl = (id?: string | null) =>
    id
        ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
        : FALLBACK_LOGO;

export default function MultiClubPicker() {
    const { selectedClubs, setSelectedClubs } = useClub();

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

    // carrega lista de clubes
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const { data } = await api.get<ClubListItem[]>(CLUBS_URL);
                if (!cancel) setClubs(data ?? []);
            } catch (e: any) {
                if (!cancel) setErr(e?.message ?? "Erro ao carregar clubes");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => {
            cancel = true;
        };
    }, []);

    const selectedIds = useMemo(
        () => new Set(selectedClubs.map((c) => c.clubId)),
        [selectedClubs]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return clubs;
        return clubs.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                String(c.clubId).includes(q)
        );
    }, [clubs, query]);

    function toggleClub(c: ClubListItem) {
        if (selectedIds.has(c.clubId)) {
            // remover
            setSelectedClubs(selectedClubs.filter((x) => x.clubId !== c.clubId));
        } else {
            // adicionar (mantém os já selecionados)
            setSelectedClubs([
                ...selectedClubs,
                {
                    clubId: c.clubId,
                    clubName: c.name,
                    crestAssetId: c.crestAssetId ?? null,
                },
            ]);
        }
    }

    function clearAll() {
        setSelectedClubs([]);
    }

    return (
        <div className="relative" ref={ref}>
            {/* Botão atual */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 bg-white text-blue-600 px-2 py-1 rounded border"
                title={
                    selectedClubs.length > 0
                        ? selectedClubs.map((c) => c.clubName ?? c.clubId).join(", ")
                        : "Selecionar clubes"
                }
            >
                {selectedClubs.length > 0 ? (
                    <>
                        {/* mostra até 3 escudos + contador */}
                        <div className="flex -space-x-1">
                            {selectedClubs.slice(0, 3).map((c) => (
                                <img
                                    key={c.clubId}
                                    src={crestUrl(c.crestAssetId)}
                                    onError={(e) =>
                                        ((e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO)
                                    }
                                    alt=""
                                    className="w-6 h-6 rounded-full border bg-white"
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
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="opacity-80"
                >
                    <path
                        d="M5.5 7.5l4.5 4.5 4.5-4.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                    />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 mt-2 w-96 bg-white text-black rounded-xl shadow-lg border z-50">
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
                        <>
                            <ul className="max-h-80 overflow-auto">
                                {filtered.length === 0 && (
                                    <li className="p-3 text-sm text-gray-600">
                                        Nenhum clube encontrado.
                                    </li>
                                )}
                                {filtered.map((c) => {
                                    const checked = selectedIds.has(c.clubId);
                                    return (
                                        <li
                                            key={c.clubId}
                                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                            onClick={() => toggleClub(c)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleClub(c)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <img
                                                src={crestUrl(c.crestAssetId)}
                                                onError={(e) =>
                                                ((e.currentTarget as HTMLImageElement).src =
                                                    FALLBACK_LOGO)
                                                }
                                                alt=""
                                                className="w-7 h-7 rounded-full border bg-white"
                                            />
                                            <div className="min-w-0">
                                                {/* nome mais escuro para legibilidade */}
                                                <div className="font-medium leading-tight truncate text-gray-900">
                                                    {c.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    ID: {c.clubId}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>

                            <div className="p-2 border-t flex items-center justify-between">
                                <button
                                    className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                                    onClick={() => setOpen(false)}
                                >
                                    Fechar
                                </button>
                                <div className="flex items-center gap-2">
                                    {selectedClubs.length > 0 && (
                                        <button
                                            className="text-sm px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                            onClick={clearAll}
                                        >
                                            Limpar seleção
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
