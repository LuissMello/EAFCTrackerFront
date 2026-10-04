import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useRefresh } from "./useRefresh.tsx";

/* Modo "ao vivo" (server-side, global para todos os visitantes) */
export interface LiveState {
  enabled: boolean;
  /** Legado: o backend não expira mais o modo; tolerado se vier preenchido */
  untilUtc: string | null;
  intervalMinutes: number;
}

const LIVE_OFF: LiveState = { enabled: false, untilUtc: null, intervalMinutes: 5 };
const LIVE_POLL_MS = 60_000;

function normalizeLive(d: any): LiveState {
  return {
    enabled: d?.enabled === true,
    untilUtc: typeof d?.untilUtc === "string" && d.untilUtc ? d.untilUtc : null,
    intervalMinutes: Number(d?.intervalMinutes) > 0 ? Number(d.intervalMinutes) : 5,
  };
}

type LiveModeContextType = {
  live: LiveState;
  liveBusy: boolean;
  liveError: string | null;
  toggleLive: () => Promise<void>;
  liveLabel: string;
  liveTitle: string;
};

const LiveModeContext = createContext<LiveModeContextType | undefined>(undefined);

/**
 * Estado do modo "Ao vivo" compartilhado por toda a app. Lê o estado ao montar e a cada 60s (aba visível).
 * Enquanto ligado e com a aba visível, dispara `triggerRefresh()` a cada 60s — único lugar dessa rotina.
 */
export function LiveModeProvider({ children }: { children: React.ReactNode }) {
  const { triggerRefresh } = useRefresh();
  const [live, setLive] = useState<LiveState>(LIVE_OFF);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Refs para o timer único ler o valor mais recente sem se recriar
  const enabledRef = useRef(false);
  enabledRef.current = live.enabled;
  const busyRef = useRef(false);
  busyRef.current = liveBusy;
  const triggerRef = useRef(triggerRefresh);
  triggerRef.current = triggerRefresh;

  const loadLive = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get(API_ENDPOINTS.FETCH_LIVE, { signal });
      if (signal?.aborted || !mountedRef.current) return;
      setLive(normalizeLive(data));
    } catch {
      /* silencioso: mantém o último estado conhecido */
    }
  }, []);

  // Estado inicial ao montar
  useEffect(() => {
    const controller = new AbortController();
    loadLive(controller.signal);
    return () => controller.abort();
  }, [loadLive]);

  // A cada 60s (só com a aba visível): reconfere o estado no servidor (outro visitante pode ter ligado/desligado)
  // e, se estiver ligado, pede a atualização dos dados. Ao voltar à aba, faz o mesmo na hora.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!busyRef.current) loadLive();
      if (enabledRef.current) triggerRef.current();
    };
    const id = setInterval(tick, LIVE_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadLive]);

  const toggleLive = useCallback(async () => {
    if (busyRef.current) return;
    const target = !enabledRef.current;
    setLiveBusy(true);
    setLiveError(null);
    try {
      const { data } = await api.post(API_ENDPOINTS.FETCH_LIVE, { enabled: target });
      if (!mountedRef.current) return;
      setLive(normalizeLive(data));
      if (target) triggerRef.current();
    } catch (e: any) {
      if (!mountedRef.current) return;
      const status = e?.response?.status;
      setLiveError(
        status
          ? `Não foi possível ${target ? "ligar" : "desligar"} o modo ao vivo (HTTP ${status}).`
          : `Não foi possível ${target ? "ligar" : "desligar"} o modo ao vivo. Verifique a conexão.`
      );
    } finally {
      if (mountedRef.current) setLiveBusy(false);
    }
  }, []);

  const liveLabel = live.enabled ? "Ao vivo" : "Ligar modo ao vivo";
  const liveTitle = live.enabled
    ? `Ao vivo: busca automática a cada ${live.intervalMinutes} min até alguém desligar. Vale para todos os visitantes. Clique para desligar.`
    : `Ligar o modo ao vivo para todos os visitantes: busca automática a cada ${live.intervalMinutes} min até alguém desligar.`;

  const value = useMemo<LiveModeContextType>(
    () => ({ live, liveBusy, liveError, toggleLive, liveLabel, liveTitle }),
    [live, liveBusy, liveError, toggleLive, liveLabel, liveTitle]
  );

  return <LiveModeContext.Provider value={value}>{children}</LiveModeContext.Provider>;
}

export function useLiveMode(): LiveModeContextType {
  const ctx = useContext(LiveModeContext);
  if (!ctx) throw new Error("useLiveMode deve ser usado dentro de um LiveModeProvider");
  return ctx;
}
