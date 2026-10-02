import React from "react";
import { Card } from "../ui.tsx";
import type { DisplayGoal } from "../../types/goalRegistration.ts";

interface Props {
  goals: DisplayGoal[];
  /** Chave do gol que está sendo refeito (destacado). */
  editingKey: number | null;
  readOnly?: boolean;
  onEdit: (goal: DisplayGoal) => void;
  onRemove: (goal: DisplayGoal) => void;
  onRetry: () => void;
  onDiscard: () => void;
  headingId?: string;
}

/** "Gols desta partida (n)": ordem preservada, "Fulano ← Beltrano ← Sicrano", editar/remover e estado de salvamento por gol. */
export const GoalList = React.memo(function GoalList({ goals, editingKey, readOnly = false, onEdit, onRemove, onRetry, onDiscard, headingId }: Props) {
  return (
    <Card className="p-4">
      <h3 id={headingId} className="font-display font-bold text-lg uppercase tracking-wide leading-none text-fg">
        Gols desta partida ({goals.length})
      </h3>
      {goals.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border-strong p-4 text-sm text-fg-muted">
          Nenhum gol ainda. Quando o time marcar, toque em quem fez o gol: cada gol é salvo na hora.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {goals.map((g, i) => (
            <li
              key={g.key}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 ${
                g.failed ? "border-negative/50 bg-negative-soft" : editingKey === g.key ? "border-accent bg-accent/10" : "border-border bg-surface-raised"
              }`}
            >
              <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <span className="sr-only">Gol {i + 1}: </span>
                <span className="text-base font-semibold text-fg">{g.scorerName}</span>
                {g.assistName ? (
                  <span className="text-base text-fg-secondary"> ← {g.assistName}</span>
                ) : (
                  <span className="ml-2 text-xs text-fg-muted">(sem assistência)</span>
                )}
                {g.preAssistName && <span className="text-base text-fg-muted"> ← {g.preAssistName}</span>}
                {editingKey === g.key && <span className="ml-2 text-xs font-bold text-accent">editando</span>}
                {g.failed ? (
                  <div role="alert" className="mt-1 text-xs font-semibold text-negative-fg">
                    Não salvo: {g.failed}
                  </div>
                ) : (
                  g.pending && <span className="ml-2 text-xs text-fg-muted">salvando…</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.failed ? (
                  <>
                    <button type="button" className="btn btn-primary min-h-[44px]" onClick={onRetry}>
                      Tentar de novo
                    </button>
                    <button type="button" className="btn btn-secondary min-h-[44px]" onClick={onDiscard}>
                      Descartar
                    </button>
                  </>
                ) : (
                  !readOnly && (
                    <>
                      <button type="button" className="btn btn-secondary min-h-[44px]" onClick={() => onEdit(g)} aria-label={`Editar gol ${i + 1}: ${g.scorerName}`}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-[44px] text-negative-fg"
                        onClick={() => onRemove(g)}
                        aria-label={`Remover gol ${i + 1}: ${g.scorerName}`}
                      >
                        Remover
                      </button>
                    </>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
});
