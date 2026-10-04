import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Card, PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { ClubSelect, EmptyPanel, ErrorPanel, NoClubPanel } from "../components/analytics/Controls.tsx";
import { CardGrid, CardGridSkeleton } from "../components/cards/CardGrid.tsx";
import CardDetail from "../components/cards/CardDetail.tsx";
import { CardsFiltersBar } from "../components/cards/CardsFiltersBar.tsx";
import { CompareView, ComparePickers, type PlayerOption } from "../components/cards/CompareView.tsx";
import type { CardsMode } from "../components/cards/ModeToggle.tsx";
import type { CardSlot } from "../components/cards/PlayerCard.tsx";
import { useAnalyticsClub } from "../hooks/useAnalyticsClub.ts";
import { useGameVersions } from "../hooks/useGameVersions.tsx";
import { usePlayerCards } from "../hooks/usePlayerCards.ts";
import { usePlayerCompare } from "../hooks/usePlayerCompare.ts";
import { useUrlDateRange } from "../hooks/useUrlDateRange.ts";
import { useUrlEnum, useUrlParams, useUrlState } from "../hooks/useUrlState.ts";
import type { CardFilters, PlayerCard } from "../types/playerCards";
import { plural } from "../utils/analyticsFormat.ts";
import { rangeForPreset } from "../utils/dateRanges.ts";
import { SORT_VALUES, sortCards } from "../utils/playerCards.ts";

/** Padrão: últimos 365 dias (uma temporada inteira costuma caber; o período aparece na URL). */
const defaultCardsRange = () => rangeForPreset("365d");

/** id de jogador vindo da URL (?a=&b=): inteiro positivo ou null. */
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

export default function Cartas() {
  const { options, active, pick, clubsLoading } = useAnalyticsClub();
  const { versions, currentVersion, loading: versionsLoading } = useGameVersions();
  const clubId = active?.clubId ?? null;

  // Filtros e escolhas ficam na URL (replace): link copiado reproduz a tela
  const [range, setRange] = useUrlDateRange(defaultCardsRange);
  const [versionRaw, setVersionRaw] = useUrlState("versao", ""); // "" = versão atual, "todas", ou o número
  const [minMatches, setMinMatches] = useUrlState("min", 3, { validate: (n) => Number.isInteger(n) && n >= 1 && n <= 30 });
  const [sort, setSort] = useUrlEnum("ordem", "overall", SORT_VALUES);

  // modo/a/b mudam juntos (ex.: "Comparar" + jogador A): uma única escrita na URL evita que uma atualização apague a outra
  const [params, patchUrl] = useUrlParams();
  const aId = parseId(params.get("a") ?? "");
  const bId = parseId(params.get("b") ?? "");
  const comparing = params.get("modo") === "comparar" || aId !== null || bId !== null;
  const mode: CardsMode = comparing ? "comparar" : "cartas";

  const gameVersion = useMemo<number | null>(() => {
    if (versionRaw === "todas") return null;
    const n = parseId(versionRaw);
    return n ?? currentVersion;
  }, [versionRaw, currentVersion]);

  const onVersion = useCallback(
    (v: number | null) => setVersionRaw(v === null ? "todas" : v === currentVersion ? "" : String(v)),
    [setVersionRaw, currentVersion]
  );

  const filters = useMemo<CardFilters>(
    () => ({ from: range.from, to: range.to, gameVersion, minMatches }),
    [range.from, range.to, gameVersion, minMatches]
  );

  const cardsRes = usePlayerCards(clubId, filters, !versionsLoading);
  const compareRes = usePlayerCompare(clubId, aId, bId, filters, !versionsLoading);

  const data = cardsRes.data;
  const sorted = useMemo(() => (data ? sortCards(data.cards, sort) : []), [data, sort]);

  // Selects A/B: jogadores da grade + (se vierem pela URL e não estiverem na grade) os nomes da resposta da comparação
  const playerOptions = useMemo<PlayerOption[]>(() => {
    const map = new Map<number, string>();
    for (const c of data?.cards ?? []) map.set(c.playerEntityId, c.name);
    if (compareRes.data) {
      map.set(compareRes.data.a.playerEntityId, compareRes.data.a.name);
      map.set(compareRes.data.b.playerEntityId, compareRes.data.b.name);
    }
    for (const id of [aId, bId]) if (id !== null && !map.has(id)) map.set(id, `Jogador #${id}`);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  }, [data, compareRes.data, aId, bId]);

  // ---- detalhe (diálogo) ----
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = useMemo(() => sorted.find((c) => c.playerEntityId === detailId) ?? null, [sorted, detailId]);
  const closeDetail = useCallback(() => setDetailId(null), []);

  // ---- escolha A/B (grade e selects) ----
  const setPair = useCallback(
    (a: number | null, b: number | null, modo?: CardsMode) =>
      patchUrl({ a, b, ...(modo ? { modo: modo === "comparar" ? "comparar" : null } : {}) }),
    [patchUrl]
  );

  const latest = useRef({ comparing, aId, bId });
  latest.current = { comparing, aId, bId };

  const onSelectCard = useCallback(
    (card: PlayerCard) => {
      const id = card.playerEntityId;
      const { comparing: on, aId: a, bId: b } = latest.current;
      if (!on) {
        setDetailId(id);
        return;
      }
      if (id === a) setPair(null, b);
      else if (id === b) setPair(a, null);
      else if (a === null) setPair(id, b);
      else if (b === null) setPair(a, id);
      else setPair(a, id); // A e B já escolhidos: o novo clique substitui o B
    },
    [setPair]
  );

  const slotOf = useCallback((id: number): CardSlot => (id === aId ? "A" : id === bId ? "B" : null), [aId, bId]);

  const focusBAfterCompare = useRef(false);
  const onCompareFromDetail = useCallback(
    (card: PlayerCard) => {
      setDetailId(null);
      setPair(card.playerEntityId, latest.current.bId === card.playerEntityId ? null : latest.current.bId, "comparar");
      focusBAfterCompare.current = true;
    },
    [setPair]
  );
  useEffect(() => {
    if (!focusBAfterCompare.current || !comparing) return;
    focusBAfterCompare.current = false;
    document.getElementById("cmp-B")?.focus();
  }, [comparing, aId]);

  const onMode = useCallback(
    (m: CardsMode) => {
      if (m === "comparar") setPair(latest.current.aId, latest.current.bId, "comparar");
      else setPair(null, null, "cartas");
    },
    [setPair]
  );

  const onSwap = useCallback(() => setPair(latest.current.bId, latest.current.aId), [setPair]);
  const onClearCompare = useCallback(() => setPair(null, null), [setPair]);
  const changeA = useCallback(
    (id: number | null) => {
      if (id !== null && id === latest.current.bId) return;
      setPair(id, latest.current.bId);
    },
    [setPair]
  );
  const changeB = useCallback(
    (id: number | null) => {
      if (id !== null && id === latest.current.aId) return;
      setPair(latest.current.aId, id);
    },
    [setPair]
  );

  if (!active) {
    if (clubsLoading) {
      return (
        <PageShell className="space-y-4" aria-busy>
          <PageHeader title="Cartas" className="mb-0" />
          <Skeleton className="h-32 rounded-2xl" />
        </PageShell>
      );
    }
    return <NoClubPanel what="as cartas dos jogadores" title="Cartas" />;
  }

  const loading = cardsRes.loading || versionsLoading;
  const compareReady = aId !== null && bId !== null && aId !== bId;
  const compareHint =
    aId === bId && aId !== null
      ? "Escolha dois jogadores diferentes para comparar."
      : aId === null && bId === null
        ? "Escolha o jogador A e o jogador B nos campos acima ou tocando nas cartas abaixo."
        : aId === null
          ? "Falta escolher o jogador A."
          : "Falta escolher o jogador B.";

  const liveText = loading
    ? "Carregando cartas…"
    : cardsRes.error
      ? ""
      : data
        ? `${data.cards.length} ${plural(data.cards.length, "carta", "cartas")} no período.`
        : "";

  return (
    <PageShell className="space-y-4">
      <PageHeader
        eyebrow={active.name}
        title="Cartas"
        subtitle="Cartas de jogador no estilo FUT, calculadas só com o desempenho do clube."
        className="mb-0"
        actions={<ClubSelect options={options} value={clubId} onChange={pick} />}
      />

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-fg-secondary"
      >
        <Info size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-accent" />
        <p>
          <strong className="text-fg">Notas relativas a escalas fixas; poucos jogos distorcem.</strong> Menos de 10 jogos = carta
          provisória (nota puxada para o meio).
        </p>
      </div>

      <CardsFiltersBar
        range={range}
        onRange={setRange}
        versions={versions}
        gameVersion={gameVersion}
        onVersion={onVersion}
        minMatches={minMatches}
        onMinMatches={setMinMatches}
        sort={sort}
        onSort={setSort}
        mode={mode}
        onMode={onMode}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {liveText}
      </div>

      {comparing && (
        <section aria-labelledby="cartas-comparador" className="space-y-4">
          <h2 id="cartas-comparador" className="font-display text-lg font-bold uppercase tracking-wide text-fg">
            Comparador
          </h2>
          <Card className="p-3 sm:p-4">
            <ComparePickers
              options={playerOptions}
              a={aId}
              b={bId}
              onChangeA={changeA}
              onChangeB={changeB}
              onSwap={onSwap}
              onClear={onClearCompare}
            />
          </Card>
          <CompareView
            ready={compareReady}
            needHint={compareHint}
            loading={compareRes.loading}
            error={compareRes.error}
            data={compareRes.data}
            onRetry={compareRes.reload}
            onClear={onClearCompare}
            crestAssetId={active.crestAssetId}
            clubName={active.name}
          />
        </section>
      )}

      <section aria-labelledby="cartas-grade" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="cartas-grade" className="font-display text-lg font-bold uppercase tracking-wide text-fg">
            {comparing ? "Escolha pela grade" : "Jogadores"}
          </h2>
          {data && data.cards.length > 0 && (
            <p className="text-sm text-fg-muted">
              {data.cards.length} {plural(data.cards.length, "carta", "cartas")} · {data.totalMatches}{" "}
              {plural(data.totalMatches, "partida", "partidas")} no período
            </p>
          )}
        </div>
        {comparing && (
          <p className="text-sm text-fg-muted">Toque numa carta para escolhê-la como A ou B; toque de novo para tirar da comparação.</p>
        )}

        {cardsRes.error && <ErrorPanel message={cardsRes.error.message} onRetry={cardsRes.reload} />}
        {loading && !cardsRes.error && <CardGridSkeleton />}

        {data && !loading && data.cards.length === 0 && (
          <EmptyPanel
            icon="🃏"
            title={
              data.totalMatches === 0
                ? "Nenhuma partida neste recorte"
                : `Nenhum jogador com ${minMatches} ${plural(minMatches, "jogo", "jogos")} no período`
            }
            message={
              data.totalMatches === 0
                ? "Amplie o período ou escolha outra versão do jogo."
                : "Reduza o mínimo de jogos ou amplie o período para ver mais cartas."
            }
          />
        )}

        {data && !loading && data.cards.length > 0 && (
          <CardGrid
            cards={sorted}
            crestAssetId={active.crestAssetId}
            clubName={active.name}
            compareMode={comparing}
            slotOf={slotOf}
            onSelect={onSelectCard}
            label="Cartas dos jogadores"
          />
        )}
      </section>

      {detail && (
        <CardDetail
          card={detail}
          crestAssetId={active.crestAssetId}
          clubName={active.name}
          onClose={closeDetail}
          onCompare={onCompareFromDetail}
        />
      )}
    </PageShell>
  );
}
