import React from "react";
import type { GoalRegistration } from "../../types/goalRegistration.ts";

interface Meta {
  label: string;
  icon: string;
  cls: string;
}

const ACCENT = "bg-accent/10 text-accent border-accent/40";
const NEUTRAL = "bg-surface-sunken text-fg-secondary border-border-strong";
const WARN = "bg-warning-soft text-warning-fg border-warning/50";
const OK = "bg-positive-soft text-positive-fg border-positive/40";

type StatusInput = Pick<GoalRegistration, "status" | "finishedAt" | "suggestedMatch">;

/** Estado exibido do registro (rótulo + ícone + cor), combinando status, finalização e sugestão de partida. */
export function registrationMeta(r: StatusInput): Meta {
  switch (r.status) {
    case "Pending":
      return r.finishedAt
        ? { label: "Finalizada · aguardando a partida", icon: "◔", cls: NEUTRAL }
        : { label: "Em andamento", icon: "●", cls: ACCENT };
    case "NeedsReview":
      return r.suggestedMatch ? { label: "Sugestão de partida", icon: "?", cls: WARN } : { label: "Para revisão", icon: "!", cls: WARN };
    case "Linked":
      return { label: "Vinculada", icon: "✓", cls: OK };
    case "Expired":
      return { label: "Expirada", icon: "×", cls: "bg-surface-sunken text-fg-muted border-border-strong" };
    default:
      return { label: String(r.status), icon: "?", cls: "bg-surface-sunken text-fg-muted border-border-strong" };
  }
}

export function statusLabel(r: StatusInput): string {
  return registrationMeta(r).label;
}

/** Em andamento de fato: Pending e não finalizada. */
export function isInProgress(r: Pick<GoalRegistration, "status" | "finishedAt">): boolean {
  return r.status === "Pending" && !r.finishedAt;
}

/** Chip de status: sempre texto + ícone + cor (a cor nunca é o único indicador). */
export const StatusChip = React.memo(function StatusChip({ registration, className = "" }: { registration: StatusInput; className?: string }) {
  const m = registrationMeta(registration);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none ${m.cls} ${className}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  );
});
