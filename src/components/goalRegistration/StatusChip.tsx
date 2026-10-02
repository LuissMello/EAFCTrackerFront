import React from "react";
import type { RegistrationStatus } from "../../types/goalRegistration.ts";

const META: Record<RegistrationStatus, { label: string; icon: string; cls: string }> = {
  Pending: { label: "Em andamento", icon: "●", cls: "bg-accent/10 text-accent border-accent/40" },
  Linked: { label: "Vinculado", icon: "✓", cls: "bg-positive-soft text-positive-fg border-positive/40" },
  NeedsReview: { label: "Precisa revisar", icon: "!", cls: "bg-warning-soft text-warning-fg border-warning/50" },
  Expired: { label: "Expirado", icon: "×", cls: "bg-surface-sunken text-fg-muted border-border-strong" },
};

export function statusLabel(status: RegistrationStatus): string {
  return META[status]?.label ?? status;
}

/** Chip de status: sempre texto + ícone + cor (a cor nunca é o único indicador). */
export const StatusChip = React.memo(function StatusChip({ status, className = "" }: { status: RegistrationStatus; className?: string }) {
  const m = META[status] ?? { label: String(status), icon: "?", cls: "bg-surface-sunken text-fg-muted border-border-strong" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none ${m.cls} ${className}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  );
});
