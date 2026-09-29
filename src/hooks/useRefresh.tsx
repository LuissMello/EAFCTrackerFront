import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type RefreshContextType = {
  /** Incrementa a cada `triggerRefresh()`; páginas de dados refazem a busca quando muda */
  refreshKey: number;
  /** Pede a todas as páginas para reler os dados do backend (não dispara /api/fetch/run) */
  triggerRefresh: () => void;
};

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const value = useMemo(() => ({ refreshKey, triggerRefresh }), [refreshKey, triggerRefresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshContextType {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh deve ser usado dentro de um RefreshProvider");
  return ctx;
}
