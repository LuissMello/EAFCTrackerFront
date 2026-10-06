import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

/**
 * Estado "linha separada por arquétipo" por jogador/linha (não vai para a URL) + gerenciamento de foco:
 * ao expandir ou juntar a linha é recriada, então o foco vai para o botão "par" (expandir <-> juntar).
 */
export function useSegmentExpansion() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pendingFocus = useRef<string | null>(null);

  const isOpen = useCallback((key: string) => expanded.has(key), [expanded]);
  const setOpen = useCallback((key: string, open: boolean) => {
    pendingFocus.current = segmentToggleId(key, open ? "join" : "exp");
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [expanded]);

  return { isOpen, setOpen };
}

export function segmentToggleId(key: string, kind: "exp" | "join"): string {
  return `seg-${kind}-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/**
 * Botão único para separar/juntar os arquétipos de uma linha de jogador. Fica sempre à ESQUERDA da célula do jogador,
 * na mesma posição nos dois estados: seta (separar) ou "+" (juntar). Alvo de toque de 44 px sem aumentar a altura da linha
 * (o botão visível tem 28 px; a área clicável extra é um pseudo-elemento).
 */
export function SegmentToggle({
  idKey,
  open,
  onToggle,
  name,
  count,
}: {
  idKey: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  name: string;
  /** Quantas linhas (segmentos) a separação gera. */
  count: number;
}) {
  return (
    <button
      type="button"
      id={segmentToggleId(idKey, open ? "join" : "exp")}
      aria-label={open ? "Juntar arquétipos" : "Separar por arquétipo"}
      aria-expanded={open}
      title={open ? `Juntar os ${count} arquétipos de ${name} numa linha só` : `Separar ${name} em ${count} linhas (uma por arquétipo/posição)`}
      onClick={() => onToggle(!open)}
      className="relative inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg-secondary transition before:absolute before:-inset-2 before:content-[''] hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {open ? <Plus size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
    </button>
  );
}

/** Espaço do tamanho do botão, para alinhar nomes de linhas sem botão (ou de segmentos) com as que têm. */
export function SegmentToggleSpacer() {
  return <span aria-hidden="true" className="inline-block h-7 w-7 flex-shrink-0" />;
}

export default SegmentToggle;
