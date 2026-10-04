import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { ClubSelect, EmptyPanel, ErrorPanel, NoClubPanel, NoticeBar } from "../components/analytics/Controls.tsx";
import NightNavigator from "../components/gameNight/NightNavigator.tsx";
import NightKpis from "../components/gameNight/NightKpis.tsx";
import NightTimeline from "../components/gameNight/NightTimeline.tsx";
import NightSrChart from "../components/gameNight/NightSrChart.tsx";
import NightPlayersTable from "../components/gameNight/NightPlayersTable.tsx";
import NightOpponents from "../components/gameNight/NightOpponents.tsx";
import { useAnalyticsClub } from "../hooks/useAnalyticsClub.ts";
import { useGameNights } from "../hooks/useGameNights.ts";
import { useGameNight } from "../hooks/useGameNight.ts";
import { fmtYmdWithWeekday } from "../utils/analyticsFormat.ts";

/** Distância horizontal mínima (px) e razão horizontal/vertical para contar como "swipe". */
const SWIPE_MIN_DX = 70;
const SWIPE_RATIO = 1.8;
const SWIPE_MAX_MS = 800;

/** Teclas de seta não devem trocar de noite enquanto o usuário digita/seleciona algo. */
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = t.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "listbox" || role === "slider" || role === "spinbutton";
}

function parseSession(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function NightSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando a noite…</span>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}

export default function NoiteDeJogo() {
  const { options, active, pick, clubsLoading } = useAnalyticsClub();
  const clubId = active?.clubId ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const requestedId = parseSession(searchParams.get("session"));

  const nightsRes = useGameNights(clubId);
  const nights = useMemo(() => nightsRes.data?.nights ?? [], [nightsRes.data]);
  const latest = nights.length > 0 ? nights[nights.length - 1] : null;

  const requestedExists = requestedId !== null && nights.some((n) => n.sessionId === requestedId);
  const currentId = nights.length === 0 ? null : requestedExists ? requestedId : latest!.sessionId;
  const unknownRequested = nights.length > 0 && requestedId !== null && !requestedExists;

  const [notice, setNotice] = useState<string | null>(null);

  /** Mantém ?session= na URL (replace, sem empilhar histórico) preservando os demais parâmetros (clubIds…). */
  const setSession = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(searchParamsRef.current);
      if (id === null) next.delete("session");
      else next.set("session", String(id));
      if (next.toString() !== searchParamsRef.current.toString()) setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  // ?session= desconhecido: cai na mais recente com aviso
  useEffect(() => {
    if (unknownRequested && latest) {
      setNotice("A noite pedida não foi encontrada para este clube. Mostrando a mais recente.");
      setSession(latest.sessionId);
    }
  }, [unknownRequested, latest, setSession]);

  const nightRes = useGameNight(clubId, currentId);
  const night = nightRes.data;

  // 404 no detalhe (lista desatualizada): volta para a mais recente
  const detailNotFound = nightRes.error?.status === 404;
  useEffect(() => {
    if (detailNotFound && latest && currentId !== latest.sessionId) {
      setNotice("Não foi possível abrir essa noite. Mostrando a mais recente.");
      setSession(latest.sessionId);
    }
  }, [detailNotFound, latest, currentId, setSession]);

  const currentIdx = currentId !== null ? nights.findIndex((n) => n.sessionId === currentId) : -1;
  const prevId = currentIdx > 0 ? nights[currentIdx - 1].sessionId : null;
  const nextId = currentIdx >= 0 && currentIdx < nights.length - 1 ? nights[currentIdx + 1].sessionId : null;
  const isLatest = latest !== null && currentId === latest.sessionId;

  const goPrev = useCallback(() => {
    if (prevId !== null) setSession(prevId);
  }, [prevId, setSession]);
  const goNext = useCallback(() => {
    if (nextId !== null) setSession(nextId);
  }, [nextId, setSession]);
  const goLatest = useCallback(() => setSession(null), [setSession]);

  // ---- teclado: ← / → ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  // ---- swipe horizontal (não interfere na rolagem vertical: nunca chama preventDefault) ----
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (e.touches.length !== 1 || target?.closest?.("[data-no-swipe],input,textarea,select")) {
      touch.current = null;
      return;
    }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Date.now() - s.t > SWIPE_MAX_MS) return;
    if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    if (dx > 0) goPrev(); // arrastar para a direita = noite anterior
    else goNext();
  };

  const clubName = night?.clubName ?? active?.name ?? "Clube";
  const timeZone = night?.timeZoneId ?? nightsRes.data?.timeZoneId ?? null;

  const changeClub = useCallback(
    (id: number) => {
      pick(id);
      setNotice(null);
      setSession(null);
    },
    [pick, setSession]
  );

  if (!active) {
    if (clubsLoading) {
      return (
        <PageShell className="space-y-4" aria-busy>
          <PageHeader title="Noite de jogo" className="mb-0" />
          <Skeleton className="h-32 rounded-2xl" />
        </PageShell>
      );
    }
    return <NoClubPanel what="as noites de jogo" title="Noite de jogo" />;
  }

  return (
    <PageShell className="space-y-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <PageHeader
        eyebrow={clubName}
        title="Noite de jogo"
        className="mb-0"
        actions={
          <>
            <ClubSelect options={options} value={clubId} onChange={changeClub} />
          </>
        }
      />

      {notice && <NoticeBar onDismiss={() => setNotice(null)}>{notice}</NoticeBar>}

      {/* Lista de noites */}
      {nightsRes.loading && (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Carregando noites…</span>
          <Skeleton className="h-36 rounded-2xl" />
          <NightSkeleton />
        </div>
      )}

      {nightsRes.error && (
        <ErrorPanel message={nightsRes.error.message} onRetry={nightsRes.reload} />
      )}

      {!nightsRes.loading && !nightsRes.error && nights.length === 0 && (
        <EmptyPanel
          icon="🌙"
          title="Nenhuma noite de jogo ainda"
          message="Assim que o clube tiver partidas registradas, as noites aparecem aqui."
        />
      )}

      {nights.length > 0 && currentId !== null && (
        <>
          <NightNavigator
            nights={nights}
            currentId={currentId}
            timeZone={timeZone}
            onSelect={setSession}
            onLatest={goLatest}
            isLatest={isLatest}
          />

          {nightRes.loading && !night && <NightSkeleton />}

          {nightRes.error && !detailNotFound && (
            <ErrorPanel message={nightRes.error.message} onRetry={nightRes.reload} />
          )}
          {detailNotFound && isLatest && (
            <ErrorPanel message="Esta noite não foi encontrada no servidor." onRetry={nightRes.reload} />
          )}

          {night && (
            <div className="space-y-6">
              <NightKpis night={night} />
              {night.matches.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3 space-y-6 min-w-0">
                    <NightTimeline night={night} />
                  </div>
                  <div className="lg:col-span-2 space-y-6 min-w-0">
                    <NightSrChart night={night} />
                    <NightOpponents opponents={night.opponents} />
                  </div>
                </div>
              ) : (
                <Card className="p-6 text-center text-sm text-fg-muted">Esta noite não tem partidas registradas.</Card>
              )}
              <NightPlayersTable players={night.players} />
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
