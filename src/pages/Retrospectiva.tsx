import React, { useEffect, useState } from "react";
import { PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { ClubSelect, EmptyPanel, ErrorPanel, NoClubPanel, VersionSelect } from "../components/analytics/Controls.tsx";
import {
  DuoCard,
  FunFactsCard,
  IntroCard,
  MomentsCard,
  OpponentsCard,
  PlayersCard,
  ProgressionCard,
  RhythmCard,
  StreaksCard,
} from "../components/wrapped/WrappedCards.tsx";
import { useAnalyticsClub } from "../hooks/useAnalyticsClub.ts";
import { useGameVersions } from "../hooks/useGameVersions.tsx";
import { useWrapped } from "../hooks/useWrapped.ts";

/** No mobile a página "encaixa" nos cartões (scroll-snap proximity: ajuda, mas nunca prende a rolagem). */
function useMobileScrollSnap() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const root = document.documentElement;
    const apply = () => {
      root.style.scrollSnapType = mq.matches ? "y proximity" : "";
    };
    apply();
    mq.addEventListener?.("change", apply);
    return () => {
      mq.removeEventListener?.("change", apply);
      root.style.scrollSnapType = "";
    };
  }, []);
}

function WrappedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Carregando a retrospectiva…</span>
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

export default function Retrospectiva() {
  useMobileScrollSnap();
  const { options, active, pick, clubsLoading } = useAnalyticsClub();
  const { versions, currentVersion, loading: versionsLoading } = useGameVersions();
  const clubId = active?.clubId ?? null;

  // undefined = o usuário ainda não escolheu: usa a versão atual (ou Todas, se não houver)
  const [choice, setChoice] = useState<number | null | undefined>(undefined);
  const gameVersion = choice === undefined ? currentVersion : choice;

  const wrapped = useWrapped(clubId, gameVersion, !versionsLoading);
  const data = wrapped.data;

  if (!active) {
    if (clubsLoading) {
      return (
        <PageShell size="lg" className="space-y-4" aria-busy>
          <PageHeader title="Retrospectiva" className="mb-0" />
          <Skeleton className="h-64 rounded-2xl" />
        </PageShell>
      );
    }
    return <NoClubPanel what="a retrospectiva" title="Retrospectiva" size="lg" />;
  }

  return (
    <PageShell size="lg" className="space-y-4">
      <PageHeader
        eyebrow={active.name}
        title="Retrospectiva"
        className="mb-0"
        actions={
          <>
            <ClubSelect options={options} value={clubId} onChange={pick} />
            <VersionSelect versions={versions} value={gameVersion} onChange={(v) => setChoice(v)} />
          </>
        }
      />

      {wrapped.error && <ErrorPanel message={wrapped.error.message} onRetry={wrapped.reload} />}
      {wrapped.loading && <WrappedSkeleton />}

      {data && data.totals.matches === 0 && (
        <EmptyPanel
          icon="🎬"
          title="Nenhuma partida neste recorte"
          message={
            gameVersion !== null
              ? "Este clube ainda não jogou nessa versão do jogo. Escolha outra versão ou \"Todas\"."
              : "Assim que o clube tiver partidas registradas, a retrospectiva aparece aqui."
          }
        />
      )}

      {data && data.totals.matches > 0 && (
        <div className="space-y-4 sm:space-y-6">
          <IntroCard d={data} />
          <StreaksCard d={data} />
          <MomentsCard d={data} />
          <PlayersCard d={data} />
          <DuoCard d={data} />
          <OpponentsCard d={data} />
          <RhythmCard d={data} />
          <ProgressionCard d={data} />
          <FunFactsCard d={data} />
        </div>
      )}
    </PageShell>
  );
}
