import React from "react";
import type { ArchetypeGroup, ArchetypeRef } from "../../types/archetypes.ts";
import { ArchetypeIcon } from "./ArchetypeIcon.tsx";

const GROUP_LABEL: Record<ArchetypeGroup, string> = {
  ATAQUE: "Ataque",
  MEIO: "Meio",
  DEFESA: "Defesa",
  GOLEIRO: "Goleiro",
};

export function archetypeGroupLabel(g: ArchetypeGroup | null | undefined): string | null {
  return g ? GROUP_LABEL[g] : null;
}

/** Texto curto para espaços apertados (sigla se houver, senão o rótulo). */
export function archetypeShortLabel(a: ArchetypeRef | null | undefined): string {
  if (!a) return "—";
  return a.shortName?.trim() || a.label;
}

/**
 * Selo de arquétipo. Neutro de propósito: vermelho/verde/amarelo são reservados a V/E/D.
 * - `archetype` null/undefined => "—" (sem dado: partidas antigas ou id 0). Use `hideEmpty` para não renderizar nada.
 * - `compact` usa a sigla (shortName) quando existir; o nome completo (e o grupo) ficam no title/aria-label.
 */
export const ArchetypeBadge: React.FC<{
  archetype: ArchetypeRef | null | undefined;
  compact?: boolean;
  emphasis?: boolean;
  hideEmpty?: boolean;
  className?: string;
  /** Texto extra (ex.: lista de todos os arquétipos usados) acrescentado ao title/aria-label. */
  detail?: string;
  /** `responsive`: no celular (< sm) ícone em cima e nome embaixo; a partir de sm, ícone + nome lado a lado. */
  layout?: "inline" | "responsive";
}> = ({ archetype, compact = false, emphasis = false, hideEmpty = false, className = "", detail, layout = "inline" }) => {
  if (!archetype) {
    if (hideEmpty) return null;
    return (
      <span className={`text-fg-subtle ${className}`} title="Sem arquétipo registrado nesta partida" aria-label="Sem arquétipo registrado">
        —
      </span>
    );
  }
  const group = archetypeGroupLabel(archetype.positionGroup);
  const base = group ? `${archetype.label} · ${group}` : archetype.label;
  const full = detail ? `${base}\n${detail}` : base;
  const text = compact ? archetypeShortLabel(archetype) : archetype.label;
  const stacked = layout === "responsive";
  return (
    <span
      className={`inline-flex items-center border font-medium whitespace-nowrap ${
        stacked
          ? "max-w-full flex-col gap-0.5 rounded-xl px-1.5 py-1 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs"
          : "gap-1 rounded-full px-2 py-0.5 text-xs"
      } ${
        emphasis
          ? "bg-accent/10 border-accent/40 text-accent"
          : "bg-surface-sunken border-border-strong text-fg-secondary"
      } ${className}`}
      title={full}
      aria-label={`Arquétipo: ${full.split("\n").join(". ")}`}
    >
      <ArchetypeIcon archetype={archetype} size={compact ? 12 : 14} />
      <span className="max-w-full truncate">{text}</span>
    </span>
  );
};

export default ArchetypeBadge;
