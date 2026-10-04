import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";

// ===== Tipos =====
export type ClubState = {
    clubId: number;
    clubName?: string | null;
    crestAssetId?: string | null;
};

/** Item da lista global de clubes (/api/clubs) */
export type ClubListItem = {
    clubId: number;
    name: string;
    crestAssetId?: string | null;
    /** Versão do jogo do clube (ex.: 26 = FC26); null quando desconhecida */
    gameVersion?: number | null;
};

type ClubContextType = {
    /** Primeiro clube (retrocompatibilidade) */
    club: ClubState | null;
    /** Define UM clube (substitui a seleção por um único) */
    setClub: (c: ClubState | null) => void;

    /** Seleção múltipla completa */
    selectedClubs: ClubState[];
    setSelectedClubs: (arr: ClubState[]) => void;

    /** IDs selecionados (CSV-friendly) */
    selectedClubIds: number[];

    /** Helpers convenientes */
    clubId: number | null;
    clubName: string | null;
    crestAssetId: string | null;

    /** Lista global de clubes (carregada uma única vez no provider) */
    allClubs: ClubListItem[];
    clubsLoading: boolean;
    clubsError: string | null;
    reloadClubs: () => void;
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

function parseCsvIds(csv: string | null): number[] {
    if (!csv) return [];
    return csv
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string | null) {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch {
        /* storage indisponível */
    }
}

function readStoredClubs(): ClubState[] {
    const multi = readStorage("clubs");
    if (multi) {
        try {
            const arr = JSON.parse(multi);
            if (Array.isArray(arr)) return arr.filter((x: any) => typeof x?.clubId === "number");
        } catch { /* ignore */ }
    }
    const single = readStorage("club");
    if (single) {
        try {
            const c = JSON.parse(single);
            if (c && typeof c.clubId === "number") return [c];
        } catch { /* ignore */ }
    }
    return [];
}

/**
 * Hidratação síncrona (executada uma única vez, no primeiro render):
 * URL (clubIds > clubId) tem prioridade; senão localStorage. Nomes/escudos que faltarem
 * são completados depois, quando a lista global de clubes chegar.
 */
function computeInitialSelection(params: URLSearchParams): ClubState[] {
    let ids = parseCsvIds(params.get("clubIds"));
    if (ids.length === 0) {
        const n = parseInt(params.get("clubId") ?? "", 10);
        if (Number.isFinite(n) && n > 0) ids = [n];
    }

    const stored = readStoredClubs();
    if (ids.length === 0) return stored;

    return ids.map(
        (id) => stored.find((c) => c.clubId === id) ?? { clubId: id, clubName: null, crestAssetId: null }
    );
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();

    // Refs para o "dono único" da escrita na URL ler sempre o valor mais recente sem re-disparar efeitos
    const searchParamsRef = useRef(searchParams);
    searchParamsRef.current = searchParams;
    const setSearchParamsRef = useRef(setSearchParams);
    setSearchParamsRef.current = setSearchParams;
    const lastSearchStringRef = useRef(searchParams.toString());
    const pendingSelectionUrlRef = useRef<string | null>(null);

    const [selectedClubs, setSelectedClubsState] = useState<ClubState[]>(() =>
        computeInitialSelection(searchParams)
    );

    // ===== Lista global de clubes (uma única requisição para toda a app) =====
    const [allClubs, setAllClubs] = useState<ClubListItem[]>([]);
    const [clubsLoading, setClubsLoading] = useState(true);
    const [clubsError, setClubsError] = useState<string | null>(null);
    const [clubsReloadKey, setClubsReloadKey] = useState(0);
    const knownClubIdsRef = useRef<number[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                setClubsLoading(true);
                setClubsError(null);
                const { data } = await api.get<ClubListItem[]>(API_ENDPOINTS.CLUBS, { signal: controller.signal });
                if (controller.signal.aborted) return;
                const next = Array.isArray(data) ? data : [];

                // Clube que estava na lista e sumiu (removido do tracking no admin) sai também da seleção.
                // Ids que nunca estiveram na lista (ex.: link compartilhado) são preservados.
                const nextIds = new Set(next.map((c) => c.clubId));
                const removedIds = knownClubIdsRef.current.filter((id) => !nextIds.has(id));
                knownClubIdsRef.current = next.map((c) => c.clubId);
                if (removedIds.length > 0) {
                    setSelectedClubsState((prev) => {
                        const kept = prev.filter((c) => !removedIds.includes(c.clubId));
                        return kept.length === prev.length ? prev : kept;
                    });
                }

                setAllClubs(next);
            } catch (e: any) {
                if (controller.signal.aborted || isCanceled(e)) return;
                setClubsError(e?.message ?? "Erro ao carregar clubes");
            } finally {
                if (!controller.signal.aborted) setClubsLoading(false);
            }
        })();
        return () => controller.abort();
    }, [clubsReloadKey]);

    const reloadClubs = useCallback(() => setClubsReloadKey((k) => k + 1), []);

    // Completa nome/escudo dos clubes selecionados que vieram só com o ID (ex.: link compartilhado)
    useEffect(() => {
        if (allClubs.length === 0) return;
        setSelectedClubsState((prev) => {
            if (!prev.some((c) => !c.clubName)) return prev;
            let changed = false;
            const next = prev.map((c) => {
                if (c.clubName) return c;
                const found = allClubs.find((x) => x.clubId === c.clubId);
                if (!found) return c;
                changed = true;
                return { clubId: c.clubId, clubName: found.name ?? null, crestAssetId: found.crestAssetId ?? null };
            });
            return changed ? next : prev;
        });
    }, [allClubs]);

    // Só existe um clube rastreado e nada selecionado: seleciona esse clube (uma única vez por sessão da página)
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (autoSelectedRef.current || clubsLoading || allClubs.length === 0) return;
        autoSelectedRef.current = true;
        if (allClubs.length === 1 && selectedClubs.length === 0) {
            const only = allClubs[0];
            setSelectedClubsState([{ clubId: only.clubId, clubName: only.name ?? null, crestAssetId: only.crestAssetId ?? null }]);
        }
    }, [allClubs, clubsLoading, selectedClubs.length]);

    // ===== Sincronização com localStorage e URL (único dono das chaves clubIds/clubId) =====
    const searchString = searchParams.toString();
    useEffect(() => {
        const urlChanged = searchString !== lastSearchStringRef.current;
        lastSearchStringRef.current = searchString;
        const selectionChangedLocally = pendingSelectionUrlRef.current === searchString;
        pendingSelectionUrlRef.current = null;

        // Um link explícito (inclusive voltar/avançar) escolhe o clube. Navegação sem
        // clube continua herdando a seleção atual, como nas rotas internas da app.
        if (urlChanged && !selectionChangedLocally) {
            const current = searchParamsRef.current;
            if (current.has("clubIds") || current.has("clubId")) {
                const ids = parseCsvIds(current.get("clubIds"));
                if (ids.length === 0 && current.has("clubId")) {
                    const id = Number(current.get("clubId"));
                    if (Number.isInteger(id) && id > 0) ids.push(id);
                }
                if (ids.join(",") !== selectedClubs.map((c) => c.clubId).join(",")) {
                    setSelectedClubsState(ids.map((id) => {
                        const previous = selectedClubs.find((c) => c.clubId === id);
                        if (previous) return previous;
                        const known = allClubs.find((c) => c.clubId === id);
                        return { clubId: id, clubName: known?.name ?? null, crestAssetId: known?.crestAssetId ?? null };
                    }));
                    return;
                }
            }
        }

        if (selectedClubs.length > 0) {
            writeStorage("clubs", JSON.stringify(selectedClubs));
            // Mantém também o antigo "club" com o primeiro, para compat.
            writeStorage("club", JSON.stringify(selectedClubs[0]));
        } else {
            writeStorage("clubs", null);
            writeStorage("club", null);
        }

        // Só toca nas chaves clubIds/clubId; demais parâmetros (page, size, filtros…) ficam intactos
        const current = searchParamsRef.current;
        const next = new URLSearchParams(current);
        if (selectedClubs.length > 0) {
            next.set("clubIds", selectedClubs.map((c) => c.clubId).join(","));
            next.delete("clubId");
        } else {
            next.delete("clubIds");
            next.delete("clubId");
        }
        if (next.toString() !== current.toString()) {
            setSearchParamsRef.current(next, { replace: true });
        }
    }, [selectedClubs, searchString, allClubs]);

    // ===== Setters públicos =====
    const setSelectedClubs = useCallback((arr: ClubState[]) => {
        pendingSelectionUrlRef.current = searchParamsRef.current.toString();
        setSelectedClubsState(Array.isArray(arr) ? arr.filter(Boolean) : []);
    }, []);

    const setClub = useCallback((c: ClubState | null) => {
        pendingSelectionUrlRef.current = searchParamsRef.current.toString();
        setSelectedClubsState(c ? [c] : []);
    }, []);

    // Helpers / retrocompatibilidade
    const club = selectedClubs[0] ?? null;
    const selectedClubIds = useMemo(
        () => selectedClubs.map((c) => c.clubId),
        [selectedClubs]
    );

    const value = useMemo<ClubContextType>(
        () => ({
            club,
            setClub,
            selectedClubs,
            setSelectedClubs,
            selectedClubIds,

            clubId: club?.clubId ?? null,
            clubName: club?.clubName ?? null,
            crestAssetId: club?.crestAssetId ?? null,

            allClubs,
            clubsLoading,
            clubsError,
            reloadClubs,
        }),
        [club, setClub, selectedClubs, setSelectedClubs, selectedClubIds, allClubs, clubsLoading, clubsError, reloadClubs]
    );

    return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
    const ctx = useContext(ClubContext);
    if (!ctx) throw new Error("useClub deve ser usado dentro de um ClubProvider");
    return ctx;
}
