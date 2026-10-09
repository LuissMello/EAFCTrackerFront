import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import { fmtDateTimeBR, fmtTimeBR, goalsLabel } from "../../utils/goalRegistration.ts";
import type { GoalRegistration, OpponentRef, OpponentResult, SuggestedMatch } from "../../types/goalRegistration.ts";
import { OpponentPreviewCard } from "./OpponentPreviewCard.tsx";
import { OpponentSearch } from "./OpponentSearch.tsx";
import type { useOpponentPreview } from "../../hooks/useOpponentPreview.ts";

/** Botão "Finalizar partida" com confirmação inline leve (sem diálogo). */
export const FinishControl = forwardRef<
  HTMLButtonElement,
  {
    confirming: boolean;
    busy: boolean;
    disabled: boolean;
    disabledReason?: string;
    onAsk: () => void;
    onConfirm: () => void;
    onCancel: () => void;
  }
>(function FinishControl({ confirming, busy, disabled, disabledReason, onAsk, onConfirm, onCancel }, ref) {
  if (!confirming) {
    return (
      <div>
        <button ref={ref} type="button" className="btn btn-primary min-h-[48px] w-full text-base" onClick={onAsk} disabled={disabled}>
          Finalizar partida
        </button>
        <p className="mt-1 text-center text-xs text-fg-muted">{disabled && disabledReason ? disabledReason : "Use quando o jogo acabar: o registro passa a aguardar a partida aparecer."}</p>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Confirmar finalização" className="rounded-2xl border-2 border-accent/60 bg-accent/5 p-3">
      <p className="text-sm font-semibold text-fg">Finalizar? Você poderá reabrir enquanto a partida não for vinculada.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-[48px] flex-1" onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? "Finalizando…" : "Sim, finalizar"}
        </button>
        <button type="button" className="btn btn-secondary min-h-[48px] flex-1" onClick={onCancel} disabled={busy}>
          Voltar
        </button>
      </div>
    </div>
  );
});

/** Estado "Finalizada — aguardando a partida aparecer": Reabrir + Nova partida. */
export const FinishedPanel = forwardRef<
  HTMLHeadingElement,
  { finishedAt: string; busy: boolean; onReopen: () => void; onNew: () => void }
>(function FinishedPanel({ finishedAt, busy, onReopen, onNew }, ref) {
  return (
    <section aria-labelledby="finished-title" className="rounded-2xl border-2 border-border-strong bg-surface-sunken p-4">
      <h3 id="finished-title" ref={ref} tabIndex={-1} className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-fg outline-none">
        Finalizada — aguardando a partida aparecer
      </h3>
      <p className="mt-1 text-sm text-fg-muted">
        Finalizada às {fmtTimeBR(finishedAt)}. Quando a partida for buscada, o vínculo é feito automaticamente. Os gols ficam bloqueados; reabra para
        editar.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-[48px] flex-1" onClick={onNew}>
          Nova partida
        </button>
        <button type="button" className="btn btn-secondary min-h-[48px] flex-1" onClick={onReopen} disabled={busy}>
          {busy ? "Reabrindo…" : "Reabrir"}
        </button>
      </div>
    </section>
  );
});

/** NeedsReview com `suggestedMatch`: "É essa?" com vincular / não é essa. */
export const SuggestionCard = forwardRef<
  HTMLHeadingElement,
  { suggestion: SuggestedMatch; goalCount: number; busy: "confirm" | "dismiss" | null; onConfirm: () => void; onDismiss: () => void }
>(function SuggestionCard({ suggestion: s, goalCount, busy, onConfirm, onDismiss }, ref) {
  return (
    <section aria-labelledby="suggestion-title" className="rounded-2xl border-2 border-warning/60 bg-warning-soft p-4 text-warning-fg">
      <h3 id="suggestion-title" ref={ref} tabIndex={-1} className="font-display text-lg font-bold uppercase leading-tight tracking-wide outline-none">
        Sugestão de partida
      </h3>
      <p className="mt-1 text-sm">
        Encontramos uma partida contra <strong>{s.opponentName}</strong> (placar{" "}
        <strong className="tabular-nums">
          {s.ourGoals}–{s.theirGoals}
        </strong>
        , {fmtDateTimeBR(s.playedAt)}) que bate com os seus {goalsLabel(goalCount)}. É essa?
      </p>
      {!s.goalsMatch && (
        <p role="note" className="mt-2 rounded-lg border border-warning/50 bg-surface/60 p-2 text-sm font-semibold">
          Atenção: o placar dessa partida tem {goalsLabel(s.ourGoals)} do seu time, mas você registrou {goalsLabel(goalCount)}. Confira antes de vincular.
        </p>
      )}
      <p className="mt-2 text-xs">
        <Link to={`/match/${s.matchId}`} className="font-semibold text-fg underline underline-offset-2" target="_blank" rel="noreferrer">
          Ver a partida #{s.matchId}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-[48px] flex-1" onClick={onConfirm} disabled={busy !== null}>
          {busy === "confirm" ? "Vinculando…" : "Sim, vincular"}
        </button>
        <button type="button" className="btn btn-secondary min-h-[48px] flex-1" onClick={onDismiss} disabled={busy !== null}>
          {busy === "dismiss" ? "Descartando…" : "Não é essa"}
        </button>
      </div>
    </section>
  );
});

/** "Trocar adversário": busca (foco no campo), prévia do escolhido e confirmação. */
export function ChangeOpponentPanel({
  clubId,
  currentName,
  candidate,
  preview,
  busy,
  error,
  onSelect,
  onConfirm,
  onClose,
}: {
  clubId: number;
  currentName: string;
  candidate: OpponentRef | null;
  preview: ReturnType<typeof useOpponentPreview>;
  busy: boolean;
  error: string | null;
  onSelect: (r: OpponentResult) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Trocar adversário"
      className="rounded-2xl border-2 border-accent/50 bg-surface p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-fg">Trocar adversário</h3>
          <p className="text-xs text-fg-muted">Hoje: {currentName}. Procure o time certo (confira o clube #id e a divisão quando houver nomes parecidos).</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-[44px] flex-shrink-0" onClick={onClose} disabled={busy}>
          Fechar
        </button>
      </div>
      <div className="mt-3">
        <OpponentSearch
          clubId={clubId}
          selectedId={candidate?.clubId ?? null}
          onSelect={onSelect}
          autoFocus
          selectionSlot={
            candidate ? (
              <div className="mt-3 rounded-2xl border-2 border-accent/60 bg-accent/5 p-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Novo adversário</p>
                <OpponentPreviewCard
                  name={candidate.name}
                  status={preview.status}
                  preview={preview.preview}
                  error={preview.error}
                  onRetry={preview.retry}
                  crestAssetId={candidate.crestAssetId}
                  customCrestAssetId={candidate.customCrestAssetId}
                  className="!shadow-none"
                />
                {error && (
                  <p role="alert" className="mt-2 rounded-lg border border-negative/40 bg-negative-soft p-2 text-sm text-negative-fg">
                    {error}
                  </p>
                )}
                <button type="button" className="btn btn-primary mt-3 min-h-[52px] w-full text-base" onClick={onConfirm} disabled={busy}>
                  {busy ? "Trocando…" : `Trocar para ${candidate.name}`}
                </button>
              </div>
            ) : null
          }
        />
      </div>
    </section>
  );
}

/** Pode trocar de adversário: ainda não vinculada nem expirada. */
export function canChangeOpponent(r: Pick<GoalRegistration, "status">): boolean {
  return r.status === "Pending" || r.status === "NeedsReview";
}
