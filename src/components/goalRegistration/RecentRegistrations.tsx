import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Skeleton } from "../ui.tsx";
import { fmtDateTimeBR, goalsLabel } from "../../utils/goalRegistration.ts";
import type { GoalRegistration } from "../../types/goalRegistration.ts";
import { StatusChip } from "./StatusChip.tsx";

const INITIAL_VISIBLE = 8;

const Row = React.memo(function Row({ r, onOpen }: { r: GoalRegistration; onOpen: (r: GoalRegistration) => void }) {
  const count = r.goalsCount ?? r.goals.length;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface-raised p-2.5">
      <button
        type="button"
        onClick={() => onOpen(r)}
        className="flex min-h-[56px] min-w-0 flex-1 basis-56 flex-col items-start justify-center rounded-lg px-1.5 text-left transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Abrir registro contra ${r.opponentName}`}
      >
        <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 max-w-full truncate text-base font-semibold text-fg">{r.opponentName}</span>
          <StatusChip registration={r} className="flex-shrink-0" />
        </span>
        <span className="mt-0.5 text-xs text-fg-muted">
          {fmtDateTimeBR(r.startedAt ?? r.createdAt)} · {goalsLabel(count)}
        </span>
      </button>
      {r.matchId !== null && r.matchId !== undefined && (
        <Link
          to={`/match/${r.matchId}`}
          className="btn btn-secondary min-h-[44px]"
          aria-label={`Ver partida ${r.matchId} do registro contra ${r.opponentName}`}
        >
          Ver partida
        </Link>
      )}
    </li>
  );
});

interface Props {
  items: GoalRegistration[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onOpen: (r: GoalRegistration) => void;
}

/** "Registros recentes" do clube: toque abre na tela de pontuação (ver/editar). */
export function RecentRegistrations({ items, loading, error, onReload, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = items ? (expanded ? items : items.slice(0, INITIAL_VISIBLE)) : [];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase leading-none tracking-wide text-fg">Registros recentes</h2>
        <button type="button" className="btn btn-secondary min-h-[44px]" onClick={onReload} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <div aria-live="polite">
        {loading && !items && (
          <div className="mt-3 space-y-2" role="status">
            <span className="sr-only">Carregando registros…</span>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[60px] rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative-fg">
            <span className="min-w-[12rem] flex-1">{error}</span>
            <button type="button" className="btn btn-secondary" onClick={onReload}>
              Tentar de novo
            </button>
          </div>
        )}

        {items && items.length === 0 && !error && (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong p-4 text-sm text-fg-muted">
            Nenhum registro recente para este clube. Inicie um acima quando o jogo começar.
          </p>
        )}
      </div>

      {items && items.length > 0 && (
        <>
          <ul className="mt-3 space-y-2">
            {visible.map((r) => (
              <Row key={r.id} r={r} onOpen={onOpen} />
            ))}
          </ul>
          {items.length > INITIAL_VISIBLE && (
            <button type="button" className="btn btn-secondary mt-3 min-h-[44px] w-full" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Mostrar menos" : `Mostrar todos (${items.length})`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
