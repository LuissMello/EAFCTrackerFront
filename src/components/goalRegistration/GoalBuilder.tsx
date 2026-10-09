import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Card, Skeleton } from "../ui.tsx";
import { sortRoster } from "../../utils/goalRegistration.ts";
import type { DisplayGoal, GoalLine, RosterPlayer } from "../../types/goalRegistration.ts";

export const MAX_GOALS = 40;

type Phase = "scorer" | "assist" | "preAssist";
interface Pick {
  id: number;
  name: string;
}

const PlayerButton = React.memo(function PlayerButton({ p, onPick }: { p: RosterPlayer; onPick: (p: RosterPlayer) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(p)}
      className={`flex min-h-[60px] w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition hover:border-accent hover:bg-accent/10 active:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        p.active ? "border-border-strong bg-surface" : "border-dashed border-border bg-surface-sunken"
      }`}
    >
      <span className="w-full truncate text-base font-semibold text-fg">{p.name}</span>
      <span className="text-xs text-fg-muted">
        {p.position || "—"}
        {!p.active && " · inativo"}
      </span>
    </button>
  );
});

const SKIP_BTN =
  "col-span-full flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface px-3 py-2 text-base font-semibold text-fg-secondary transition hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

interface Props {
  players: RosterPlayer[] | null;
  loading: boolean;
  error: string | null;
  onRetryRoster: () => void;
  /** Quantos gols já existem (para numerar e aplicar o limite de 40). */
  goalCount: number;
  /** Gol em edição (null = novo gol). */
  editing: DisplayGoal | null;
  /** Posição (1-based) do gol em edição na lista. */
  editingNumber?: number;
  onSubmit: (line: GoalLine) => void;
  onCancelEdit: () => void;
  /** Registro expirado: sem edição. */
  readOnly?: boolean;
  /** Texto do estado somente-leitura (padrão: registro expirado). */
  readOnlyMessage?: string;
}

/**
 * Montagem de UM gol por vez: artilheiro → assistência → pré-assistência (só se houve assistência), com botões grandes
 * do NOSSO elenco. Ao concluir, `onSubmit` recebe o gol (o pai o salva na hora). Dá para voltar uma etapa e cancelar.
 */
export function GoalBuilder({ players, loading, error, onRetryRoster, goalCount, editing, editingNumber, onSubmit, onCancelEdit, readOnly = false, readOnlyMessage }: Props) {
  const [phase, setPhase] = useState<Phase>("scorer");
  const [scorer, setScorer] = useState<Pick | null>(null);
  const [assist, setAssist] = useState<Pick | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const sorted = useMemo(() => (players ? sortRoster(players) : []), [players]);
  const activeCount = useMemo(() => sorted.filter((p) => p.active).length, [sorted]);
  const inactiveCount = sorted.length - activeCount;
  // Se ninguém está ativo, mostra todo mundo (não deixa a tela vazia)
  const showAll = showInactive || activeCount === 0;
  const visible = useMemo(() => (showAll ? sorted : sorted.filter((p) => p.active)), [sorted, showAll]);

  const candidates = useMemo(
    () =>
      visible.filter((p) => {
        if (phase === "scorer") return true;
        if (scorer && p.playerEntityId === scorer.id) return false;
        if (phase === "preAssist" && assist && p.playerEntityId === assist.id) return false;
        return true;
      }),
    [visible, phase, scorer, assist]
  );

  const resetFlow = useCallback(() => {
    setPhase("scorer");
    setScorer(null);
    setAssist(null);
  }, []);

  // Começar a editar outro gol (ou sair da edição) reinicia o fluxo
  const editingKey = editing?.key ?? null;
  const firstRun = useRef(true);
  useEffect(() => {
    resetFlow();
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (editingKey !== null) headingRef.current?.focus();
  }, [editingKey, resetFlow]);

  // Foco no título do painel a cada etapa (leitores de tela e teclado seguem o fluxo)
  const phaseFirst = useRef(true);
  useEffect(() => {
    if (phaseFirst.current) {
      phaseFirst.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [phase, goalCount]);

  const finish = useCallback(
    (a: Pick | null, pre: Pick | null) => {
      if (!scorer) return;
      onSubmit({
        scorerPlayerEntityId: scorer.id,
        scorerName: scorer.name,
        assistPlayerEntityId: a?.id ?? null,
        assistName: a?.name ?? null,
        preAssistPlayerEntityId: a ? pre?.id ?? null : null,
        preAssistName: a ? pre?.name ?? null : null,
      });
      resetFlow();
    },
    [scorer, onSubmit, resetFlow]
  );

  const pick = useCallback(
    (p: RosterPlayer) => {
      const who: Pick = { id: p.playerEntityId, name: p.name };
      if (phase === "scorer") {
        setScorer(who);
        setPhase("assist");
      } else if (phase === "assist") {
        setAssist(who);
        setPhase("preAssist");
      } else {
        finish(assist, who);
      }
    },
    [phase, assist, finish]
  );

  const back = useCallback(() => {
    if (phase === "preAssist") {
      setAssist(null);
      setPhase("assist");
    } else if (phase === "assist") {
      setScorer(null);
      setPhase("scorer");
    }
  }, [phase]);

  const cancel = useCallback(() => {
    resetFlow();
    if (editing) onCancelEdit();
  }, [resetFlow, editing, onCancelEdit]);

  const full = !editing && goalCount >= MAX_GOALS;
  const goalNumber = editing ? editingNumber ?? goalCount : goalCount + 1;
  const title =
    phase === "scorer"
      ? editing
        ? `Editando o gol ${goalNumber}: quem fez o gol?`
        : `Quem fez o gol ${goalNumber}?`
      : phase === "assist"
      ? `Assistência de ${scorer?.name ?? ""}`
      : `Pré-assistência de ${scorer?.name ?? ""} ← ${assist?.name ?? ""}`;
  const subtitle =
    phase === "scorer"
      ? "Toque no jogador que marcou. O gol é salvo assim que você terminar."
      : phase === "assist"
      ? "Quem deu o passe para o gol?"
      : `Quem deu o passe para ${assist?.name ?? "a assistência"}?`;
  const progress = [scorer?.name, assist?.name].filter(Boolean).join(" ← ");

  if (readOnly) {
    return (
      <Card className="p-4">
        <p role="status" className="text-sm text-fg-muted">
          {readOnlyMessage ?? "Este registro expirou e não pode mais ser alterado."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4" aria-labelledby={headingId} role="group">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="scroll-mt-[calc(var(--nav-h,0px)+8rem)] font-display font-bold text-lg uppercase tracking-wide leading-tight text-fg outline-none"
          >
            {title}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
        </div>
        {inactiveCount > 0 && activeCount > 0 && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--color-accent))]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar jogadores inativos ({inactiveCount})
          </label>
        )}
      </div>

      {progress && phase !== "scorer" && (
        <p className="mt-2 inline-block rounded-lg bg-surface-sunken px-2.5 py-1 text-sm font-semibold text-fg-secondary">
          Gol {goalNumber}: {progress} ← ?
        </p>
      )}

      {editing && phase === "scorer" && (
        <p className="mt-2 text-xs text-fg-muted">Estava: {[editing.scorerName, editing.assistName, editing.preAssistName].filter(Boolean).join(" ← ")}</p>
      )}

      {loading && !players && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="status">
          <span className="sr-only">Carregando elenco…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-xl" />
          ))}
        </div>
      )}

      {error && !players && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative-fg">
          <span className="min-w-[12rem] flex-1">{error}</span>
          <button type="button" className="btn btn-secondary" onClick={onRetryRoster}>
            Tentar de novo
          </button>
        </div>
      )}

      {players && players.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-border-strong p-4 text-sm text-fg-muted">
          Nenhum jogador deste clube foi encontrado ainda. Os jogadores aparecem depois que a primeira partida deles é buscada.
        </p>
      )}

      {full && (
        <p role="status" className="mt-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-fg">
          Limite de {MAX_GOALS} gols por registro atingido.
        </p>
      )}

      {players && players.length > 0 && !full && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {phase === "assist" && (
            <button type="button" onClick={() => finish(null, null)} className={SKIP_BTN}>
              Sem assistência
            </button>
          )}
          {phase === "preAssist" && (
            <button type="button" onClick={() => finish(assist, null)} className={SKIP_BTN}>
              Sem pré-assistência
            </button>
          )}
          {candidates.map((p) => (
            <PlayerButton key={p.playerEntityId} p={p} onPick={pick} />
          ))}
        </div>
      )}

      {(phase !== "scorer" || editing) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {phase !== "scorer" && (
            <button type="button" className="btn btn-secondary min-h-[44px]" onClick={back}>
              ← Voltar uma etapa
            </button>
          )}
          <button type="button" className="btn btn-secondary min-h-[44px]" onClick={cancel}>
            {editing ? "Cancelar edição do gol" : "Cancelar este gol"}
          </button>
        </div>
      )}
    </Card>
  );
}
