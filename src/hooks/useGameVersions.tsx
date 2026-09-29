import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";

/** Versão do jogo (FC25/26/27…) — GET /api/game-versions */
export interface GameVersion {
  id: number;
  version: number;
  name: string | null;
  startsAt: string | null;
  isCurrent: boolean;
}

/** "FC26" para 26. */
export function gameVersionLabel(version: number): string {
  return `FC${version}`;
}

type GameVersionsContextType = {
  /** Mais nova primeiro */
  versions: GameVersion[];
  /** Número da versão marcada como atual (ou null) */
  currentVersion: number | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const GameVersionsContext = createContext<GameVersionsContextType | undefined>(undefined);

export function GameVersionsProvider({ children }: { children: React.ReactNode }) {
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get<GameVersion[]>(API_ENDPOINTS.GAME_VERSIONS, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const list = (Array.isArray(data) ? data : [])
          .filter((v) => typeof v?.version === "number")
          .sort((a, b) => b.version - a.version);
        setVersions(list);
      } catch (e: any) {
        if (controller.signal.aborted || isCanceled(e)) return;
        setError(e?.message ?? "Erro ao carregar versões do jogo");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const currentVersion = useMemo(() => versions.find((v) => v.isCurrent)?.version ?? null, [versions]);

  const value = useMemo<GameVersionsContextType>(
    () => ({ versions, currentVersion, loading, error, reload }),
    [versions, currentVersion, loading, error, reload]
  );

  return <GameVersionsContext.Provider value={value}>{children}</GameVersionsContext.Provider>;
}

export function useGameVersions(): GameVersionsContextType {
  const ctx = useContext(GameVersionsContext);
  if (!ctx) throw new Error("useGameVersions deve ser usado dentro de um GameVersionsProvider");
  return ctx;
}
