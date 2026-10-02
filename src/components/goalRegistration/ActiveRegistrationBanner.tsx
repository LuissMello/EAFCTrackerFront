import React from "react";
import { fmtElapsed, fmtTimeBR, goalsLabel } from "../../utils/goalRegistration.ts";
import type { GoalRegistration } from "../../types/goalRegistration.ts";
import { StatusChip } from "./StatusChip.tsx";

interface Props {
  registration: GoalRegistration;
  onContinue: () => void;
  onCancel: () => void;
  error?: string | null;
}

/** "Registro em andamento contra X — iniciado às HH:mm" com Continuar / Cancelar registro. */
export const ActiveRegistrationBanner = React.memo(function ActiveRegistrationBanner({ registration: r, onContinue, onCancel, error }: Props) {
  const startedAt = r.startedAt ?? r.createdAt;
  const count = r.goalsCount ?? r.goals.length;
  return (
    <section aria-label="Registro em andamento" className="rounded-2xl border-2 border-accent bg-accent/10 p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={r.status} />
        <span className="text-xs text-fg-muted">{fmtElapsed(startedAt)}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-fg">
        Registro em andamento contra {r.opponentName} <span className="font-medium text-fg-secondary">— iniciado às {fmtTimeBR(startedAt)}</span>
      </p>
      <p className="mt-0.5 text-sm text-fg-muted">{goalsLabel(count)} registrado{count === 1 ? "" : "s"} até agora.</p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-negative/40 bg-negative-soft p-2 text-sm text-negative-fg">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-[52px] flex-1 text-base" onClick={onContinue}>
          Continuar
        </button>
        <button type="button" className="btn btn-secondary min-h-[52px] flex-1 text-base text-negative-fg" onClick={onCancel}>
          Cancelar registro
        </button>
      </div>
    </section>
  );
});
