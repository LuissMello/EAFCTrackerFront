import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "../ConfirmDialog.tsx";
import { Crest } from "../ui.tsx";
import { crestUrl } from "../../config/urls.ts";
import { useLiveMode } from "../../hooks/useLiveMode.tsx";
import { useOpponentPreview } from "../../hooks/useOpponentPreview.ts";
import { useRefresh } from "../../hooks/useRefresh.tsx";
import { useRegistrationEditor } from "../../hooks/useRegistrationEditor.ts";
import { useRoster } from "../../hooks/useRoster.ts";
import api from "../../services/api.ts";
import { API_ENDPOINTS } from "../../config/urls.ts";
import {
  changeGoalRegistrationOpponent,
  confirmGoalRegistrationSuggestion,
  deleteGoalRegistration,
  dismissGoalRegistrationSuggestion,
  finishGoalRegistration,
  reopenGoalRegistration,
} from "../../services/goalRegistrations.ts";
import { describeApiError } from "../../utils/apiError.ts";
import { fmtElapsed, fmtTimeBR, goalChain, goalsLabel } from "../../utils/goalRegistration.ts";
import type { DisplayGoal, GoalLine, GoalRegistration, OpponentRef, OpponentResult, OpponentSearchResponse } from "../../types/goalRegistration.ts";
import { GoalBuilder } from "./GoalBuilder.tsx";
import { GoalList } from "./GoalList.tsx";
import { OpponentPreviewCard } from "./OpponentPreviewCard.tsx";
import { StatusChip } from "./StatusChip.tsx";
import { ChangeOpponentPanel, FinishControl, FinishedPanel, SuggestionCard, canChangeOpponent } from "./RegistrationActions.tsx";

const SNACK_MS = 6000;

interface Snack {
  id: number;
  text: string;
  /** Ação de desfazer (some quando a janela de 6 s termina). */
  undo?: () => void;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

interface Props {
  initial: GoalRegistration;
  clubId: number;
  /** Escudo do adversário (só quando o registro foi iniciado a partir da busca). */
  opponentCrestAssetId?: string | null;
  /** Escudo alternativo (crest do kit) se o escudo principal não existir no CDN. */
  opponentCustomCrestAssetId?: string | null;
  /** Volta para a tela inicial (o registro continua aberto). */
  onExit: () => void;
  /** O registro foi cancelado (DELETE) e a tela inicial deve ser mostrada. */
  onCancelled: () => void;
  /** "Nova partida": volta ao início já com a busca de adversário em foco. */
  onNewMatch: () => void;
}

/**
 * Tela de pontuação, pensada para uso com uma mão durante o jogo: cabeçalho fixo com adversário, tempo decorrido
 * e estado de salvamento; botões grandes do elenco; cada gol é salvo no instante em que termina (fila serializada).
 */
export function ScoringScreen({ initial, clubId, opponentCrestAssetId: propCrest, opponentCustomCrestAssetId: propCustomCrest, onExit, onCancelled, onNewMatch }: Props) {
  const editor = useRegistrationEditor(initial);
  const { registration: reg, goals, saveState, rejection } = editor;
  const roster = useRoster(clubId);
  const { live, liveBusy, toggleLive } = useLiveMode();
  const { refreshKey } = useRefresh();
  const online = useOnline();

  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const snackSeq = useRef(0);
  const [pendingRemove, setPendingRemove] = useState<DisplayGoal | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [livePromptDismissed, setLivePromptDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ---- finalizar / reabrir / sugestão / trocar adversário ----
  // O escudo recebido (props) pertence ao adversário com que a tela abriu; se o adversário mudar (troca manual ou sugestão
  // confirmada), ele deixa de valer e o escudo do novo adversário é resolvido (escolha da busca ou busca pelo nome).
  const initialOpponentId = useRef(initial.opponentClubId).current;
  type CrestInfo = { opponentId: number; crest: string | null; custom: string | null };
  const [crestOverride, setCrestOverride] = useState<CrestInfo | null>(null);
  const [crestLookup, setCrestLookup] = useState<CrestInfo | null>(null);
  const known: CrestInfo | null =
    crestOverride && crestOverride.opponentId === reg.opponentClubId
      ? crestOverride
      : reg.opponentClubId === initialOpponentId && (propCrest || propCustomCrest)
      ? { opponentId: initialOpponentId, crest: propCrest ?? null, custom: propCustomCrest ?? null }
      : crestLookup && crestLookup.opponentId === reg.opponentClubId
      ? crestLookup
      : null;
  const opponentCrestAssetId = known?.crest ?? null;
  const opponentCustomCrestAssetId = known?.custom ?? null;
  const crestKnown = known !== null;
  const lookupOpponentId = reg.opponentClubId;
  const lookupName = reg.opponentName;
  useEffect(() => {
    if (crestKnown || lookupName.length < 2) return;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await api.get<OpponentSearchResponse>(API_ENDPOINTS.GOAL_REG_OPPONENT_SEARCH(lookupName, clubId, 20), { signal: controller.signal });
        if (controller.signal.aborted) return;
        const match = data.results?.find((r) => r.clubId === lookupOpponentId);
        const crest = match?.crestAssetId ?? (match?.teamId != null ? String(match.teamId) : null);
        if (!match || (!crest && !match.customCrestAssetId)) return;
        setCrestLookup({ opponentId: lookupOpponentId, crest, custom: match.customCrestAssetId ?? null });
      } catch {
        /* sem escudo: o cabeçalho continua funcionando */
      }
    })();
    return () => controller.abort();
  }, [crestKnown, lookupOpponentId, lookupName, clubId]);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<null | "finish" | "reopen" | "confirm" | "dismiss">(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [candidate, setCandidate] = useState<OpponentRef | null>(null);
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const finishBtnRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef<HTMLHeadingElement>(null);
  const suggestionRef = useRef<HTMLHeadingElement>(null);
  const changeBtnRef = useRef<HTMLButtonElement>(null);
  const linkedRef = useRef<HTMLParagraphElement>(null);
  const reviewRef = useRef<HTMLParagraphElement>(null);
  const pendingFocus = useRef<"finished" | "finish" | "change" | "status" | null>(null);
  const previewId = useId();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (snackTimer.current) clearTimeout(snackTimer.current);
    };
  }, []);

  // Tempo decorrido atualizado a cada 30 s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Relê o registro (ex.: a partida foi vinculada) ao atualizar a página/voltar à aba — só quando não há envios pendentes
  const { refresh } = editor;
  useEffect(() => {
    void refresh(); // também no mount: os dados vindos da lista podem estar antigos
  }, [refreshKey, refresh]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Voltou a conexão: tenta de novo o que ficou parado
  const { retry } = editor;
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      retry(); // sem efeito se nada falhou
    }
  }, [online, retry]);

  // Avisa antes de fechar a aba com gols ainda não salvos
  useEffect(() => {
    if (saveState === "saved") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const showSnack = useCallback((text: string, undo?: () => void) => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    const id = ++snackSeq.current;
    setSnack({ id, text, undo });
    snackTimer.current = setTimeout(() => {
      if (mountedRef.current) setSnack((s) => (s && s.id === id ? null : s));
    }, SNACK_MS);
  }, []);

  const { add, edit, remove, resolveKey } = editor;

  // Edição recusada pelo servidor: o "Gol salvo ✓ — Desfazer" deixou de valer
  useEffect(() => {
    if (rejection) setSnack(null);
  }, [rejection]);

  const handleSubmit = useCallback(
    (line: GoalLine) => {
      if (editingKey !== null) {
        const key = editingKey;
        const prev = goals.find((g) => g.key === resolveKey(key));
        const prevLine: GoalLine | null = prev
          ? {
              scorerPlayerEntityId: prev.scorerPlayerEntityId,
              scorerName: prev.scorerName ?? "",
              assistPlayerEntityId: prev.assistPlayerEntityId ?? null,
              assistName: prev.assistName ?? null,
              preAssistPlayerEntityId: prev.preAssistPlayerEntityId ?? null,
              preAssistName: prev.preAssistName ?? null,
            }
          : null;
        edit(key, line);
        setEditingKey(null);
        showSnack("Gol atualizado ✓", prevLine ? () => edit(key, prevLine) : undefined);
      } else {
        const tempKey = add(line);
        showSnack(saveState === "error" ? "Gol anotado — aguardando salvar" : "Gol salvo ✓", () => remove(tempKey));
      }
    },
    [editingKey, goals, edit, add, remove, resolveKey, showSnack, saveState]
  );

  const handleEditStart = useCallback((g: DisplayGoal) => {
    setEditingKey(g.key);
    setSnack(null);
  }, []);
  const handleCancelEdit = useCallback(() => setEditingKey(null), []);
  const handleRemoveAsk = useCallback((g: DisplayGoal) => setPendingRemove(g), []);

  const confirmRemove = useCallback(() => {
    if (pendingRemove) {
      remove(pendingRemove.key);
      if (editingKey !== null && resolveKey(editingKey) === resolveKey(pendingRemove.key)) setEditingKey(null);
      setSnack(null);
    }
    setPendingRemove(null);
  }, [pendingRemove, remove, editingKey, resolveKey]);

  const confirmCancelRegistration = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await deleteGoalRegistration(reg.id);
      onCancelled();
    } catch (e) {
      if (!mountedRef.current) return;
      setCancelError(describeApiError(e, "Não foi possível cancelar o registro.").message);
      setConfirmCancel(false);
    } finally {
      if (mountedRef.current) setCancelling(false);
    }
  }, [reg.id, onCancelled]);

  const preview = useOpponentPreview(reg.opponentClubId, reg.opponentName, clubId, previewOpen);

  const runLifecycle = useCallback(
    async (kind: "finish" | "reopen" | "confirm" | "dismiss", fn: () => Promise<GoalRegistration>, focus: typeof pendingFocus.current) => {
      setLifecycleBusy(kind);
      setLifecycleError(null);
      try {
        const res = await fn();
        if (!mountedRef.current) return;
        editor.applyServer(res);
        setConfirmingFinish(false);
        pendingFocus.current = focus;
      } catch (e) {
        if (!mountedRef.current) return;
        const info = describeApiError(e, "Não foi possível concluir a ação.");
        setLifecycleError(info.message);
        // 409/404: o estado do registro mudou no servidor (outro aparelho, linker); relê para não deixar botões obsoletos na tela
        if (info.status === 409 || info.status === 404) void editor.refresh();
      } finally {
        if (mountedRef.current) setLifecycleBusy(null);
      }
    },
    [editor]
  );

  const handleFinish = useCallback(() => void runLifecycle("finish", () => finishGoalRegistration(reg.id), "finished"), [runLifecycle, reg.id]);
  const handleReopen = useCallback(() => void runLifecycle("reopen", () => reopenGoalRegistration(reg.id), "finish"), [runLifecycle, reg.id]);
  const handleConfirmSuggestion = useCallback(
    () => void runLifecycle("confirm", () => confirmGoalRegistrationSuggestion(reg.id), "status"),
    [runLifecycle, reg.id]
  );
  const handleDismissSuggestion = useCallback(
    () => void runLifecycle("dismiss", () => dismissGoalRegistrationSuggestion(reg.id), "change"),
    [runLifecycle, reg.id]
  );

  const closeChange = useCallback(() => {
    setChangeOpen(false);
    setCandidate(null);
    setChangeError(null);
    pendingFocus.current = "change";
  }, []);
  const openChange = useCallback(() => {
    setChangeOpen(true);
    setCandidate(null);
    setChangeError(null);
    setLifecycleError(null);
  }, []);
  const handlePickOpponent = useCallback((r: OpponentResult) => {
    setChangeError(null);
    setCandidate({
      clubId: r.clubId,
      name: r.name,
      currentDivision: r.currentDivision ?? r.division ?? null,
      timesFaced: r.timesFaced ?? null,
      crestAssetId: r.crestAssetId ?? r.teamId?.toString() ?? null,
      customCrestAssetId: r.customCrestAssetId ?? null,
    });
  }, []);
  const confirmChange = useCallback(async () => {
    if (!candidate) return;
    setChanging(true);
    setChangeError(null);
    try {
      const res = await changeGoalRegistrationOpponent(reg.id, { opponentClubId: candidate.clubId, opponentName: candidate.name });
      if (!mountedRef.current) return;
      editor.applyServer(res);
      setCrestOverride({ opponentId: candidate.clubId, crest: candidate.crestAssetId ?? null, custom: candidate.customCrestAssetId ?? null });
      setChangeOpen(false);
      setCandidate(null);
      pendingFocus.current = "change";
      showSnack(`Adversário trocado para ${candidate.name} ✓`);
      void editor.refresh();
    } catch (e) {
      if (!mountedRef.current) return;
      const info = describeApiError(e, "Não foi possível trocar o adversário.");
      setChangeError(info.message);
      if (info.status === 409 || info.status === 404) void editor.refresh(); // ex.: já foi vinculada em outro aparelho
    } finally {
      if (mountedRef.current) setChanging(false);
    }
  }, [candidate, reg.id, editor, showSnack]);
  const changePreview = useOpponentPreview(candidate?.clubId ?? null, candidate?.name ?? null, clubId);

  const finished = reg.status === "Pending" && !!reg.finishedAt;
  const inProgress = reg.status === "Pending" && !reg.finishedAt;
  const suggestion = reg.status === "NeedsReview" ? reg.suggestedMatch ?? null : null;

  // Foco depois de uma ação: vai para o elemento que passou a existir. O servidor pode devolver um estado diferente do
  // esperado (ex.: ao finalizar, o linker já sugere/vincula uma partida), então cada alvo tem uma lista de reserva.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const order: Array<React.RefObject<HTMLElement>> =
      target === "finished"
        ? [finishedRef, suggestionRef, linkedRef, reviewRef]
        : target === "finish"
        ? [finishBtnRef, suggestionRef, linkedRef, reviewRef]
        : target === "status"
        ? [linkedRef, suggestionRef, reviewRef, finishedRef, finishBtnRef]
        : [changeBtnRef, linkedRef, suggestionRef, reviewRef, finishedRef];
    const el = order.map((r) => r.current).find((x): x is HTMLElement => !!x);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const editingGoal = editingKey !== null ? goals.find((g) => g.key === resolveKey(editingKey)) ?? null : null;
  const editingNumber = editingGoal ? goals.indexOf(editingGoal) + 1 : undefined;
  const expired = reg.status === "Expired";
  const locked = expired || finished;
  const startedAt = reg.startedAt ?? reg.createdAt;
  const elapsed = fmtElapsed(startedAt, now);

  const saveLabel = !online
    ? saveState === "saved"
      ? "Sem conexão"
      : "Sem conexão · salva depois"
    : saveState === "saved"
    ? "Salvo ✓"
    : saveState === "saving"
    ? "Salvando…"
    : "Erro ao salvar";
  const saveTone =
    saveState === "error"
      ? "border-negative/50 bg-negative-soft text-negative-fg"
      : !online
      ? "border-warning/50 bg-warning-soft text-warning-fg"
      : saveState === "saving"
      ? "border-accent/40 bg-accent/10 text-accent"
      : "border-positive/40 bg-positive-soft text-positive-fg";

  return (
    <div className="space-y-4">
      {/* Cabeçalho fixo: adversário, placar de gols, tempo e estado de salvamento */}
      {/* Compacto de propósito: no celular ele fica fixo no topo e não pode empurrar o elenco para baixo */}
      <div className="sticky top-[var(--nav-h,0px)] z-30 -mx-4 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-2.5">
          {opponentCrestAssetId || opponentCustomCrestAssetId ? (
            <Crest
              src={crestUrl(opponentCrestAssetId ?? opponentCustomCrestAssetId)}
              fallbackSrc={opponentCrestAssetId && opponentCustomCrestAssetId ? crestUrl(opponentCustomCrestAssetId) : null}
              size={32}
              rounded="rounded-lg"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase leading-none tracking-widest text-fg-subtle">Contra</div>
            <h2 className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-fg">{reg.opponentName}</h2>
          </div>
          <div className="flex flex-shrink-0 items-baseline gap-1" aria-label={goalsLabel(goals.length)}>
            <span className="font-display text-2xl font-black leading-none tabular-nums text-fg">{goals.length}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{goals.length === 1 ? "gol" : "gols"}</span>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <StatusChip registration={reg} />
          <span className="min-w-0 flex-1 truncate" title={`Iniciado às ${fmtTimeBR(startedAt)}`}>
            {fmtTimeBR(startedAt)}
            {elapsed ? ` · ${elapsed}` : ""}
          </span>
          <span role="status" aria-live="polite" className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${saveTone}`}>
            {saveLabel}
            {saveState === "error" && online && (
              <button type="button" className="underline underline-offset-2" onClick={editor.retry}>
                Tentar de novo
              </button>
            )}
          </span>
        </div>
      </div>

      {/* Situação do vínculo com a partida */}
      <div role="status" aria-live="polite">
        {reg.status === "Linked" && (
          <div className="rounded-2xl border border-positive/40 bg-positive-soft p-4 text-sm text-positive-fg">
            <p ref={linkedRef} tabIndex={-1} className="font-semibold outline-none">
              Vinculado à partida #{reg.matchId}.{" "}
              {reg.matchId !== null && (
                <Link to={`/match/${reg.matchId}`} className="underline underline-offset-2">
                  Ver partida
                </Link>
              )}
            </p>
            <p className="mt-1">Você ainda pode corrigir os gols aqui; a mudança vale também na partida.</p>
            {reg.reviewNote && <p className="mt-1">{reg.reviewNote}</p>}
          </div>
        )}
        {suggestion && (
          <SuggestionCard
            ref={suggestionRef}
            suggestion={suggestion}
            goalCount={goals.length}
            busy={lifecycleBusy === "confirm" || lifecycleBusy === "dismiss" ? lifecycleBusy : null}
            onConfirm={handleConfirmSuggestion}
            onDismiss={handleDismissSuggestion}
          />
        )}
        {reg.status === "NeedsReview" && !suggestion && (
          <div className="rounded-2xl border border-warning/50 bg-warning-soft p-4 text-sm text-warning-fg">
            <p ref={reviewRef} tabIndex={-1} className="font-semibold outline-none">Para revisão</p>
            <p className="mt-1">{reg.reviewNote || "O vínculo com a partida precisa de conferência."}</p>
            <p className="mt-1">Ajustes nos gols continuam possíveis; edições inválidas são recusadas com o motivo.</p>
          </div>
        )}
        {reg.status === "Expired" && (
          <p className="rounded-2xl border border-border-strong bg-surface-sunken p-3 text-sm text-fg-muted">
            Este registro expirou (nenhuma partida foi encontrada a tempo).
          </p>
        )}
      </div>

      {inProgress && !live.enabled && !livePromptDismissed && (
        <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 py-2 pl-3 pr-2 text-xs text-fg-secondary sm:text-sm">
          <span className="min-w-0 flex-1 leading-snug">
            Buscar a partida assim que acabar? <span className="text-fg-muted">Liga o modo Ao vivo para todos.</span>
          </span>
          <button type="button" className="btn btn-primary min-h-[44px] flex-shrink-0 px-3" onClick={() => void toggleLive()} disabled={liveBusy}>
            {liveBusy ? "Ligando…" : "Ligar"}
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-[44px] min-w-[44px] flex-shrink-0 px-0"
            aria-label="Agora não"
            title="Agora não"
            onClick={() => setLivePromptDismissed(true)}
          >
            ✕
          </button>
        </div>
      )}

      {rejection && (
        <div role="alert" className="flex flex-wrap items-start gap-2 rounded-2xl border border-negative/40 bg-negative-soft p-3 text-sm text-negative-fg">
          <span className="min-w-[12rem] flex-1">{rejection}</span>
          <button type="button" className="btn btn-secondary min-h-[44px]" onClick={editor.dismissRejection}>
            Fechar
          </button>
        </div>
      )}

      <GoalBuilder
        players={roster.players}
        loading={roster.loading}
        error={roster.error}
        onRetryRoster={roster.reload}
        goalCount={goals.length}
        editing={editingGoal}
        editingNumber={editingNumber}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
        readOnly={locked}
        readOnlyMessage={finished ? "Registro finalizado: reabra para editar os gols." : undefined}
      />

      <GoalList
        goals={goals}
        editingKey={editingGoal?.key ?? null}
        readOnly={locked}
        onEdit={handleEditStart}
        onRemove={handleRemoveAsk}
        onRetry={editor.retry}
        onDiscard={editor.discardFailed}
      />

      {lifecycleError && (
        <div role="alert" className="rounded-2xl border border-negative/40 bg-negative-soft p-3 text-sm text-negative-fg">
          {lifecycleError}
        </div>
      )}

      {finished && reg.finishedAt && (
        <FinishedPanel ref={finishedRef} finishedAt={reg.finishedAt} busy={lifecycleBusy === "reopen"} onReopen={handleReopen} onNew={onNewMatch} />
      )}

      {inProgress && (
        <FinishControl
          ref={finishBtnRef}
          confirming={confirmingFinish}
          busy={lifecycleBusy === "finish"}
          disabled={saveState !== "saved" || lifecycleBusy !== null}
          disabledReason="Aguarde terminar de salvar os gols para finalizar."
          onAsk={() => {
            setLifecycleError(null);
            setConfirmingFinish(true);
          }}
          onConfirm={handleFinish}
          onCancel={() => {
            setConfirmingFinish(false);
            pendingFocus.current = "finish";
          }}
        />
      )}

      {canChangeOpponent(reg) &&
        (changeOpen ? (
          <ChangeOpponentPanel
            clubId={clubId}
            currentName={reg.opponentName}
            candidate={candidate}
            preview={changePreview}
            busy={changing}
            error={changeError}
            onSelect={handlePickOpponent}
            onConfirm={() => void confirmChange()}
            onClose={closeChange}
          />
        ) : (
          <button ref={changeBtnRef} type="button" className="btn btn-secondary min-h-[48px] w-full" onClick={openChange}>
            Trocar adversário
          </button>
        ))}

      {/* Prévia do adversário (recolhida por padrão para não ocupar a tela durante o jogo) */}
      <div>
        <button
          type="button"
          className="btn btn-secondary min-h-[44px] w-full justify-between"
          aria-expanded={previewOpen}
          aria-controls={previewId}
          onClick={() => setPreviewOpen((v) => !v)}
        >
          <span>Estatísticas do adversário</span>
          <span aria-hidden="true">{previewOpen ? "▲" : "▼"}</span>
        </button>
        <div id={previewId} className="mt-2" hidden={!previewOpen}>
          {previewOpen && (
            <OpponentPreviewCard name={reg.opponentName} status={preview.status} preview={preview.preview} error={preview.error} onRetry={preview.retry} />
          )}
        </div>
      </div>

      {inProgress && (
        <p className="text-center text-xs text-fg-muted">Quando a partida for buscada, o vínculo é feito automaticamente.</p>
      )}

      {cancelError && (
        <div role="alert" className="rounded-2xl border border-negative/40 bg-negative-soft p-3 text-sm text-negative-fg">
          {cancelError}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pb-2">
        <button type="button" className="btn btn-secondary min-h-[48px] flex-1" onClick={onExit} disabled={saveState !== "saved"}>
          ← Voltar ao início
        </button>
        {reg.status !== "Linked" && (
          <button type="button" className="btn btn-secondary min-h-[48px] flex-1 text-negative-fg" onClick={() => setConfirmCancel(true)}>
            Cancelar registro
          </button>
        )}
      </div>
      <p className="text-xs text-fg-muted">
        &ldquo;Voltar ao início&rdquo; deixa o registro aberto; você pode continuar depois, mesmo recarregando a página.
        {saveState !== "saved" && " Aguarde terminar de salvar para voltar."}
      </p>

      {/* Snackbar (rola por cima do conteúdo, sem tirar o foco) */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {snack && (
          <div role="status" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-4 py-2 text-sm text-fg shadow-raised">
            <span className="flex-1 font-semibold">{snack.text}</span>
            {snack.undo && (
              <button
                type="button"
                className="btn btn-secondary min-h-[44px]"
                onClick={() => {
                  snack.undo?.();
                  setSnack(null);
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remover este gol?"
        message={pendingRemove ? `${goalChain(pendingRemove)} será removido do registro.` : undefined}
        confirmLabel="Remover"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar este registro?"
        message={`O registro contra ${reg.opponentName}${goals.length ? ` e seus ${goalsLabel(goals.length)}` : ""} será apagado. Isso não pode ser desfeito.`}
        confirmLabel="Cancelar registro"
        cancelLabel="Manter"
        danger
        busy={cancelling}
        onConfirm={() => void confirmCancelRegistration()}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
