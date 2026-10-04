import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { Card, PageHeader, PageShell } from "../components/ui.tsx";
import { ActiveRegistrationBanner } from "../components/goalRegistration/ActiveRegistrationBanner.tsx";
import { OpponentPreviewCard } from "../components/goalRegistration/OpponentPreviewCard.tsx";
import { OpponentSearch } from "../components/goalRegistration/OpponentSearch.tsx";
import { RecentRegistrations } from "../components/goalRegistration/RecentRegistrations.tsx";
import { ScoringScreen } from "../components/goalRegistration/ScoringScreen.tsx";
import { INPUT_CLS } from "../components/goalRegistration/shared.ts";
import { useClub } from "../hooks/useClub.tsx";
import { useCurrentRegistration } from "../hooks/useCurrentRegistration.ts";
import { useGoalRegistrations } from "../hooks/useGoalRegistrations.ts";
import { useOpponentPreview } from "../hooks/useOpponentPreview.ts";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { createGoalRegistration, deleteGoalRegistration } from "../services/goalRegistrations.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { GoalRegistration, OpponentRef, OpponentResult, OpponentSearchResponse } from "../types/goalRegistration.ts";

interface ActiveView {
  registration: GoalRegistration;
  crestAssetId: string | null;
  customCrestAssetId?: string | null;
}

/**
 * Registro de gols AO VIVO (substitui o papel). Tela inicial: escolher clube/adversário e "Iniciar";
 * tela de pontuação: cada gol é salvo na hora. Página pública (sem login).
 */
export default function RegistrarGols() {
  const { allClubs, selectedClubs, clubsLoading, clubsError, reloadClubs } = useClub();
  const [chosenClubId, setChosenClubId] = useState<number | null>(null);
  const defaultClubId = selectedClubs[0]?.clubId ?? allClubs[0]?.clubId ?? null;
  const clubId = chosenClubId ?? defaultClubId;
  const clubSelectId = useId();

  const [active, setActive] = useState<ActiveView | null>(null);

  // Registro reaberto (retomar/lista) não traz o escudo do adversário: busca pelo nome e usa o clube de mesmo id.
  const activeId = active?.registration.id ?? null;
  const needsCrest = active !== null && !active.crestAssetId && !active.customCrestAssetId;
  const activeOpponent = active?.registration.opponentName ?? "";
  const activeOpponentId = active?.registration.opponentClubId ?? null;
  const activeClubId = active?.registration.clubId ?? null;
  useEffect(() => {
    if (activeId === null || !needsCrest || activeOpponentId === null || activeClubId === null || activeOpponent.length < 2) return;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await api.get<OpponentSearchResponse>(
          API_ENDPOINTS.GOAL_REG_OPPONENT_SEARCH(activeOpponent, activeClubId, 20),
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const match = data.results?.find((r) => r.clubId === activeOpponentId);
        if (!match || (!match.crestAssetId && !match.customCrestAssetId)) return;
        setActive((a) =>
          a && a.registration.id === activeId
            ? { ...a, crestAssetId: match.crestAssetId ?? null, customCrestAssetId: match.customCrestAssetId ?? null }
            : a
        );
      } catch {
        /* sem escudo: o cabeçalho continua funcionando */
      }
    })();
    return () => controller.abort();
  }, [activeId, needsCrest, activeOpponent, activeOpponentId, activeClubId]);
  const [candidate, setCandidate] = useState<OpponentRef | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  const current = useCurrentRegistration(clubId);
  const recents = useGoalRegistrations(clubId);
  const preview = useOpponentPreview(candidate?.clubId ?? null, candidate?.name ?? null, clubId);

  const [confirmCancelCurrent, setConfirmCancelCurrent] = useState(false);
  const [cancellingCurrent, setCancellingCurrent] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  const selectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ao entrar na tela de pontuação, volta ao topo
  useEffect(() => {
    if (active) window.scrollTo({ top: 0 });
  }, [active]);

  // Selecionou um card: traz o painel da seleção (prévia + Iniciar) para a tela
  const candidateId = candidate?.clubId ?? null;
  useEffect(() => {
    if (candidateId === null) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    selectionRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [candidateId]);

  const handleClubChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setChosenClubId(Number(e.target.value));
    setCandidate(null);
    setStartError(null);
    setCurrentError(null);
  }, []);

  const handleSelect = useCallback((r: OpponentResult) => {
    setStartError(null);
    setCandidate({ clubId: r.clubId, name: r.name, currentDivision: r.currentDivision ?? null, timesFaced: r.timesFaced ?? null, crestAssetId: r.crestAssetId ?? null, customCrestAssetId: r.customCrestAssetId ?? null });
  }, []);

  const handleStart = useCallback(async () => {
    if (!candidate || clubId === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const registration = await createGoalRegistration({ clubId, opponentClubId: candidate.clubId, opponentName: candidate.name });
      if (!mountedRef.current) return;
      setActive({ registration, crestAssetId: candidate.crestAssetId ?? null, customCrestAssetId: candidate.customCrestAssetId ?? null });
      setCandidate(null);
    } catch (e) {
      if (mountedRef.current) setStartError(describeApiError(e, "Não foi possível iniciar o registro.").message);
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  }, [candidate, clubId]);

  const { reload: reloadCurrent, clear: clearCurrent } = current;
  const { reload: reloadRecents } = recents;

  const leaveScoring = useCallback(() => {
    setActive(null);
    reloadCurrent();
    reloadRecents();
  }, [reloadCurrent, reloadRecents]);

  const handleContinue = useCallback(() => {
    if (current.current) setActive({ registration: current.current, crestAssetId: null });
  }, [current.current]);

  const handleOpenRecent = useCallback((r: GoalRegistration) => setActive({ registration: r, crestAssetId: null }), []);

  const confirmCancelCurrentRegistration = useCallback(async () => {
    const reg = current.current;
    if (!reg) return;
    setCancellingCurrent(true);
    setCurrentError(null);
    try {
      await deleteGoalRegistration(reg.id);
      if (!mountedRef.current) return;
      clearCurrent();
      reloadCurrent(); // pode haver outro registro em andamento (o /current devolve o mais recente)
      reloadRecents();
    } catch (e) {
      if (mountedRef.current) setCurrentError(describeApiError(e, "Não foi possível cancelar o registro.").message);
    } finally {
      if (mountedRef.current) {
        setCancellingCurrent(false);
        setConfirmCancelCurrent(false);
      }
    }
  }, [current.current, clearCurrent, reloadCurrent, reloadRecents]);

  // ----- Tela de pontuação -----
  if (active && clubId !== null) {
    return (
      <PageShell size="md" className="!py-4">
        <h1 className="sr-only">Registrar gols</h1>
        <ScoringScreen
          key={active.registration.id}
          initial={active.registration}
          clubId={active.registration.clubId ?? clubId}
          opponentCrestAssetId={active.crestAssetId}
          opponentCustomCrestAssetId={active.customCrestAssetId}
          onExit={leaveScoring}
          onCancelled={leaveScoring}
        />
      </PageShell>
    );
  }

  // ----- Tela inicial -----
  const clubOptions = allClubs.map((c) => ({ id: c.clubId, name: c.name }));
  if (clubId !== null && !clubOptions.some((c) => c.id === clubId)) clubOptions.push({ id: clubId, name: `Clube #${clubId}` });

  const selectionPanel = candidate ? (
    <div ref={selectionRef} className="mt-4 rounded-2xl border-2 border-accent/60 bg-accent/5 p-2 sm:p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Adversário selecionado</p>
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
      {current.current && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-2 text-xs text-warning-fg">
          Você já tem um registro em andamento contra {current.current.opponentName}. Iniciar cria um registro novo; o outro continua salvo.
        </p>
      )}
      {startError && (
        <p role="alert" className="mt-3 rounded-lg border border-negative/40 bg-negative-soft p-2 text-sm text-negative-fg">
          {startError} Toque em &ldquo;Iniciar&rdquo; para tentar de novo.
        </p>
      )}
      {/* Fixo no rodapé enquanto o painel está na tela: no celular o card é longo e o botão não pode ficar escondido */}
      <div className="sticky bottom-0 z-20 -mx-2 -mb-2 mt-3 rounded-b-2xl border-t border-accent/30 bg-surface/95 px-2 pb-2 pt-2.5 backdrop-blur sm:-mx-3 sm:-mb-3 sm:px-3 sm:pb-3">
        <button type="button" className="btn btn-primary min-h-[56px] w-full text-lg" onClick={() => void handleStart()} disabled={starting}>
          {starting ? "Iniciando…" : "Iniciar"}
        </button>
        <p className="mt-1.5 text-center text-xs text-fg-muted">Cria o registro agora; cada gol é salvo no instante em que você o marca.</p>
      </div>
    </div>
  ) : null;

  return (
    <PageShell size="md" className="space-y-5">
      <PageHeader eyebrow="Ao vivo" title="Registrar gols" className="mb-0" />

      <div className="space-y-1 text-sm text-fg-muted">
        <p>Registre cada gol na hora, durante o jogo. Quando a partida for buscada, o vínculo é feito automaticamente.</p>
        <p>
          Já terminou o jogo e anotou no papel?{" "}
          <Link to="/" className="font-semibold text-accent underline underline-offset-2">
            Vincule direto na partida
          </Link>
          .
        </p>
      </div>

      {current.current && (
        <ActiveRegistrationBanner
          registration={current.current}
          error={currentError}
          onContinue={handleContinue}
          onCancel={() => {
            setCurrentError(null);
            setConfirmCancelCurrent(true);
          }}
        />
      )}
      {current.error && !current.current && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-fg">
          <span className="min-w-[12rem] flex-1">{current.error}</span>
          <button type="button" className="btn btn-secondary" onClick={current.reload}>
            Tentar de novo
          </button>
        </div>
      )}

      <Card className="p-4">
        <h2 className="font-display text-lg font-bold uppercase leading-none tracking-wide text-fg">
          {current.current ? "Iniciar outro registro" : "Iniciar um registro"}
        </h2>

        <div className="mt-3">
          <label htmlFor={clubSelectId} className="mb-1 block text-sm font-semibold text-fg-secondary">
            Seu clube
          </label>
          {clubsLoading && allClubs.length === 0 ? (
            <p role="status" className="text-sm text-fg-muted">
              Carregando clubes…
            </p>
          ) : clubsError && allClubs.length === 0 ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative-fg">
              <span className="min-w-[12rem] flex-1">Não foi possível carregar os clubes.</span>
              <button type="button" className="btn btn-secondary" onClick={reloadClubs}>
                Tentar de novo
              </button>
            </div>
          ) : clubOptions.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhum clube cadastrado ainda.</p>
          ) : (
            <select id={clubSelectId} className={INPUT_CLS} value={clubId ?? ""} onChange={handleClubChange}>
              {clubOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {clubId !== null && (
          <div className="mt-4">
            <OpponentSearch key={clubId} clubId={clubId} selectedId={candidate?.clubId ?? null} onSelect={handleSelect} selectionSlot={selectionPanel} />
          </div>
        )}
      </Card>

      {clubId !== null && <RecentRegistrations items={recents.items} loading={recents.loading} error={recents.error} onReload={recents.reload} onOpen={handleOpenRecent} />}

      <ConfirmDialog
        open={confirmCancelCurrent}
        title="Cancelar este registro?"
        message={
          current.current
            ? `O registro contra ${current.current.opponentName}${current.current.goals.length ? ` e seus ${current.current.goals.length} gol(s)` : ""} será apagado. Isso não pode ser desfeito.`
            : undefined
        }
        confirmLabel="Cancelar registro"
        cancelLabel="Manter"
        danger
        busy={cancellingCurrent}
        onConfirm={() => void confirmCancelCurrentRegistration()}
        onCancel={() => setConfirmCancelCurrent(false)}
      />
    </PageShell>
  );
}
