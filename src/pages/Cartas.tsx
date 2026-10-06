import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Card, PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { ClubSelect, EmptyPanel, ErrorPanel, NoClubPanel } from "../components/analytics/Controls.tsx";
import { CardGrid, CardGridSkeleton } from "../components/cards/CardGrid.tsx";
import CardDetail from "../components/cards/CardDetail.tsx";
import { CardsFiltersBar } from "../components/cards/CardsFiltersBar.tsx";
import { CompareView, ComparePickers, type PlayerOption } from "../components/cards/CompareView.tsx";
import type { CardsMode } from "../components/cards/ModeToggle.tsx";
import type { CardsView } from "../components/cards/ViewToggle.tsx";
import type { CardSlot } from "../components/cards/PlayerCard.tsx";
import { useAnalyticsClub } from "../hooks/useAnalyticsClub.ts";
import { useGameVersions } from "../hooks/useGameVersions.tsx";
import { usePlayerCards } from "../hooks/usePlayerCards.ts";
import { usePlayerCompare, type CompareSide } from "../hooks/usePlayerCompare.ts";
import { useUrlDateRange } from "../hooks/useUrlDateRange.ts";
import { useUrlEnum, useUrlParams, useUrlState } from "../hooks/useUrlState.ts";
import type { AvailablePlayer, CardFilters, PlayerCard } from "../types/playerCards";
import { plural } from "../utils/analyticsFormat.ts";
import { rangeForPreset } from "../utils/dateRanges.ts";
import { SORT_VALUES, cardKey, sortCards } from "../utils/playerCards.ts";
import { fallbackArchetypeLabel, POSITION_FILTER_OPTIONS, type ArchetypeOption } from "../utils/archetypeFilters.ts";
import { useArchetypeFilter, type ArchetypeFilterValue } from "../hooks/useArchetypeFilter.ts";

/** Padrão: últimos 365 dias (uma temporada inteira costuma caber; o período aparece na URL). */
const defaultCardsRange = () => rangeForPreset("365d");

/** id de jogador vindo da URL (?a=&b=): inteiro positivo ou null. */
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** Arquetipo de um lado na URL (?aa= / ?ab=): inteiro >= 0 (0 = segmento sem arquetipo) ou null. */
function parseArq(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** Um lado da comparacao: jogador + (na visao por arquetipo) o arquetipo; arq null e 0 sao equivalentes. */
interface Sel {
  id: number;
  arq: number | null;
}
const selKey = (s: Sel) => `${s.id}-${s.arq ?? 0}`;
const sameSel = (x: Sel | null, y: Sel | null) => x !== null && y !== null && selKey(x) === selKey(y);
const sideOf = (s: Sel | null): CompareSide | null => (s === null ? null : { id: s.id, arq: s.arq !== null && s.arq > 0 ? s.arq : null });

export default function Cartas() {
  const { options, active, pick, clubsLoading } = useAnalyticsClub();
  const { versions, currentVersion, loading: versionsLoading } = useGameVersions();
  const clubId = active?.clubId ?? null;

  // Filtros e escolhas ficam na URL (replace): link copiado reproduz a tela
  const [range, setRange] = useUrlDateRange(defaultCardsRange);
  const [versionRaw, setVersionRaw] = useUrlState("versao", ""); // "" = versão atual, "todas", ou o número
  const [minMatches, setMinMatches] = useUrlState("min", 3, { validate: (n) => Number.isInteger(n) && n >= 1 && n <= 30 });
  const [sort, setSort] = useUrlEnum("ordem", "overall", SORT_VALUES);
  // Posição + arquétipo (?pos=<grupo>&arq=<id>): o backend recalcula as cartas só com os jogos nessa posição/arquétipo
  const [archFilter, setArchFilter] = useArchetypeFilter();
  const { positionGroup, archetypeId } = archFilter;
  // Jogador (?jog=<id>): so as cartas dele; no comparador (que tem o proprio A/B) o filtro nao vale
  const [jogRaw, setJogRaw] = useUrlState("jog", "");
  const jogId = parseId(jogRaw);

  // modo/a/b mudam juntos (ex.: "Comparar" + jogador A): uma única escrita na URL evita que uma atualização apague a outra
  const [params, patchUrl] = useUrlParams();
  // Padrão: uma carta por jogador+arquétipo. ?ver=jog agrupa todos os jogos numa carta por jogador (?ver=arq antigo = padrão)
  const view: CardsView = params.get("ver") === "jog" ? "player" : "archetype";
  const segView = view === "archetype";
  const aId = parseId(params.get("a") ?? "");
  const bId = parseId(params.get("b") ?? "");
  const aArqRaw = params.get("aa");
  const bArqRaw = params.get("ab");
  const aSel = useMemo<Sel | null>(() => (aId === null ? null : { id: aId, arq: segView ? parseArq(aArqRaw) : null }), [aId, segView, aArqRaw]);
  const bSel = useMemo<Sel | null>(() => (bId === null ? null : { id: bId, arq: segView ? parseArq(bArqRaw) : null }), [bId, segView, bArqRaw]);
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

  const playerEntityId = comparing ? null : jogId;
  const filters = useMemo<CardFilters>(
    () => ({ from: range.from, to: range.to, gameVersion, minMatches, archetypeId, positionGroup, view, playerEntityId }),
    [range.from, range.to, gameVersion, minMatches, archetypeId, positionGroup, view, playerEntityId]
  );

  const cardsRes = usePlayerCards(clubId, filters, !versionsLoading);
  const compareA = useMemo(() => sideOf(aSel), [aSel]);
  const compareB = useMemo(() => sideOf(bSel), [bSel]);
  const compareRes = usePlayerCompare(clubId, compareA, compareB, filters, !versionsLoading);

  const data = cardsRes.data;

  // Opções do filtro: `availableArchetypes` vem SEM o filtro aplicado; guardamos a última lista para o select
  // não piscar/sumir enquanto uma nova resposta carrega (ex.: ao escolher um arquétipo).
  const [lastAvailable, setLastAvailable] = useState<ArchetypeOption[]>([]);
  useEffect(() => {
    if (!data || !data.availableArchetypes) return;
    setLastAvailable(
      data.availableArchetypes
        .filter((x) => x.archetype && x.archetype.id > 0)
        .map((x) => ({ id: x.archetype.id, label: x.archetype.label, count: x.players }))
        .sort((x, y) => x.label.localeCompare(y.label, "pt-BR", { numeric: true }))
    );
  }, [data]);

  // Jogadores e posicoes do filtro: guardamos a ultima lista para os selects nao piscarem enquanto uma nova resposta carrega
  const [lastPlayers, setLastPlayers] = useState<AvailablePlayer[]>([]);
  const [lastPositions, setLastPositions] = useState<string[] | null>(null);
  useEffect(() => {
    if (!data) return;
    if (data.availablePlayers) setLastPlayers([...data.availablePlayers].sort((x, y) => x.name.localeCompare(y.name, "pt-BR")));
    if (data.availablePositionGroups) setLastPositions(data.availablePositionGroups.map((g) => g.positionGroup));
  }, [data]);

  // Combinacao impossivel (ex.: trocou de jogador e a posicao/arquetipo escolhidos nao existem para ele): limpa so o que sobrou.
  // So vale quando a resposta e do jogador escolhido (eco `playerEntityId`), para nao limpar com dados do jogador anterior.
  useEffect(() => {
    if (playerEntityId === null || !data || data.playerEntityId !== playerEntityId) return;
    const posOk = positionGroup === null || !data.availablePositionGroups || data.availablePositionGroups.some((g) => g.positionGroup === positionGroup);
    const arqOk =
      archetypeId === null || !data.availableArchetypes || data.availableArchetypes.some((a) => a.archetype.id === archetypeId);
    if (posOk && arqOk) return;
    setArchFilter({ positionGroup: posOk ? positionGroup : null, archetypeId: posOk && arqOk ? archetypeId : null });
  }, [data, playerEntityId, positionGroup, archetypeId, setArchFilter]);

  const onPlayer = useCallback((id: number | null) => setJogRaw(id === null ? "" : String(id)), [setJogRaw]);
  const onClearFilters = useCallback(() => {
    setJogRaw("");
    setArchFilter({ positionGroup: null, archetypeId: null });
  }, [setJogRaw, setArchFilter]);
  const playerName = jogId === null ? null : lastPlayers.find((p) => p.playerEntityId === jogId)?.name ?? `Jogador #${jogId}`;
  const positionLabel = positionGroup === null ? null : POSITION_FILTER_OPTIONS.find((o) => o.value === positionGroup)?.label ?? positionGroup;
  const archetypeName = archetypeId === null ? null : lastAvailable.find((o) => o.id === archetypeId)?.label ?? fallbackArchetypeLabel(archetypeId);
  const archetypeLabel = [positionLabel, archetypeName].filter(Boolean).join(" · ") || null;
  const showingPlayer = !comparing ? playerName : null;
  const sorted = useMemo(() => (data ? sortCards(data.cards, sort) : []), [data, sort]);

  // Selects A/B: jogadores da grade (na visão por arquétipo: "Jogador · Arquétipo") + os da URL que não estão na grade
  const playerOptions = useMemo<PlayerOption[]>(() => {
    const map = new Map<string, PlayerOption>();
    const add = (c: Pick<PlayerCard, "playerEntityId" | "name" | "archetype">) => {
      const arq = segView ? c.archetype?.id ?? 0 : null;
      const sel = { id: c.playerEntityId, arq };
      const name = segView ? `${c.name} · ${c.archetype?.label ?? "sem arquétipo"}` : c.name;
      map.set(selKey(sel), { key: selKey(sel), id: sel.id, arq, name });
    };
    for (const c of data?.cards ?? []) add(c);
    if (compareRes.data) {
      add(compareRes.data.a);
      add(compareRes.data.b);
    }
    for (const sel of [aSel, bSel]) {
      if (sel !== null && !map.has(selKey(sel))) {
        const name = `Jogador #${sel.id}${segView ? ` · ${sel.arq ? fallbackArchetypeLabel(sel.arq) : "sem arquétipo"}` : ""}`;
        map.set(selKey(sel), { key: selKey(sel), id: sel.id, arq: sel.arq, name });
      }
    }
    return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  }, [data, compareRes.data, aSel, bSel, segView]);

  // ---- detalhe (diálogo) ----
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detail = useMemo(() => sorted.find((c) => cardKey(c) === detailKey) ?? null, [sorted, detailKey]);
  const closeDetail = useCallback(() => setDetailKey(null), []);

  // ---- escolha A/B (grade e selects) ----
  const setPair = useCallback(
    (a: Sel | null, b: Sel | null, modo?: CardsMode) =>
      patchUrl({
        a: a?.id ?? null,
        b: b?.id ?? null,
        aa: segView && a ? a.arq ?? 0 : null,
        ab: segView && b ? b.arq ?? 0 : null,
        ...(modo ? { modo: modo === "comparar" ? "comparar" : null } : {}),
      }),
    [patchUrl, segView]
  );

  const latest = useRef({ comparing, aSel, bSel });
  latest.current = { comparing, aSel, bSel };

  const selOfCard = useCallback((card: PlayerCard): Sel => ({ id: card.playerEntityId, arq: segView ? card.archetype?.id ?? 0 : null }), [segView]);

  const onSelectCard = useCallback(
    (card: PlayerCard) => {
      const sel = selOfCard(card);
      const { comparing: on, aSel: a, bSel: b } = latest.current;
      if (!on) {
        setDetailKey(cardKey(card));
        return;
      }
      if (sameSel(sel, a)) setPair(null, b);
      else if (sameSel(sel, b)) setPair(a, null);
      else if (a === null) setPair(sel, b);
      else if (b === null) setPair(a, sel);
      else setPair(a, sel); // A e B já escolhidos: o novo clique substitui o B
    },
    [setPair, selOfCard]
  );

  const slotOf = useCallback(
    (card: PlayerCard): CardSlot => {
      const sel = selOfCard(card);
      return sameSel(sel, aSel) ? "A" : sameSel(sel, bSel) ? "B" : null;
    },
    [aSel, bSel, selOfCard]
  );

  const focusBAfterCompare = useRef(false);
  const onCompareFromDetail = useCallback(
    (card: PlayerCard) => {
      setDetailKey(null);
      const sel = selOfCard(card);
      setPair(sel, sameSel(latest.current.bSel, sel) ? null : latest.current.bSel, "comparar");
      focusBAfterCompare.current = true;
    },
    [setPair, selOfCard]
  );
  useEffect(() => {
    if (!focusBAfterCompare.current || !comparing) return;
    focusBAfterCompare.current = false;
    document.getElementById("cmp-B")?.focus();
  }, [comparing, aId]);

  const onMode = useCallback(
    (m: CardsMode) => {
      if (m === "comparar") setPair(latest.current.aSel, latest.current.bSel, "comparar");
      else setPair(null, null, "cartas");
    },
    [setPair]
  );
  // trocar a visão limpa os arquétipos escolhidos nos lados (os jogadores A/B continuam)
  const onView = useCallback((v: CardsView) => patchUrl({ ver: v === "player" ? "jog" : null, aa: null, ab: null }), [patchUrl]);

  const onSwap = useCallback(() => setPair(latest.current.bSel, latest.current.aSel), [setPair]);
  const onClearCompare = useCallback(() => setPair(null, null), [setPair]);
  const changeA = useCallback(
    (opt: PlayerOption | null) => {
      const sel = opt ? { id: opt.id, arq: opt.arq } : null;
      if (sel && sameSel(sel, latest.current.bSel)) return;
      setPair(sel, latest.current.bSel);
    },
    [setPair]
  );
  const changeB = useCallback(
    (opt: PlayerOption | null) => {
      const sel = opt ? { id: opt.id, arq: opt.arq } : null;
      if (sel && sameSel(sel, latest.current.aSel)) return;
      setPair(latest.current.aSel, sel);
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
  const compareReady = aSel !== null && bSel !== null && !sameSel(aSel, bSel);
  const compareHint =
    sameSel(aSel, bSel)
      ? segView
        ? "Escolha dois lados diferentes: outro jogador ou outro arquétipo."
        : "Escolha dois jogadores diferentes para comparar."
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
        ? `${data.cards.length} ${plural(data.cards.length, "carta", "cartas")}${segView ? " por jogador e arquétipo" : ""} no período.`
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
          provisória (nota puxada para o meio).{" "}
          {segView ? (
            <>
              <strong className="text-fg">Por arquétipo:</strong> cada jogador aparece uma vez por arquétipo usado, e o overall usa os pesos do
              arquétipo (o ◆ marca quando difere da nota pela posição; passe o mouse ou abra a carta). Escolha{" "}
              <strong className="text-fg">Ver por: Jogador</strong> para agrupar todos os jogos numa carta só.
            </>
          ) : (
            <>
              <strong className="text-fg">Por jogador:</strong> uma carta por jogador com todos os jogos juntos, usando os pesos da posição.
              Volte para <strong className="text-fg">Ver por: Arquétipo</strong> para uma carta por arquétipo usado.
            </>
          )}
          {showingPlayer && (
            <>
              {" "}
              <strong className="text-fg">Jogador:</strong> mostrando só {showingPlayer}; Posição e Arquétipo listam só o que ele jogou.
            </>
          )}
          {archetypeLabel ? (
            <>
              {" "}
              <strong className="text-fg">Filtro ({archetypeLabel}):</strong> cada carta é recalculada só com os jogos do jogador nessa
              posição/arquétipo, então ele pode ter menos jogos (e uma carta provisória).
            </>
          ) : segView ? null : (
            <>
              {" "}
              Sem filtro, a carta mistura todas as posições e arquétipos que o jogador usou; os filtros{" "}
              <strong className="text-fg">Posição</strong> e <strong className="text-fg">Arquétipo</strong> recalculam a carta só com os
              jogos naquela posição/arquétipo.
            </>
          )}
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
        archetypeOptions={lastAvailable}
        archetypeFilter={archFilter}
        onArchetypeFilter={setArchFilter}
        players={lastPlayers}
        playerId={jogId}
        onPlayer={comparing ? undefined : onPlayer}
        positionValues={lastPositions}
        onClearFilters={onClearFilters}
        view={view}
        onView={onView}
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
              a={aSel ? selKey(aSel) : null}
              b={bSel ? selKey(bSel) : null}
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
            archetypeFilterId={archetypeId}
            positionFilterLabel={positionLabel}
          />
        </section>
      )}

      <section aria-labelledby="cartas-grade" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="cartas-grade" className="font-display text-lg font-bold uppercase tracking-wide text-fg">
            {comparing ? "Escolha pela grade" : segView ? "Jogadores por arquétipo" : "Jogadores"}
          </h2>
          {data && data.cards.length > 0 && (
            <p className="text-sm text-fg-muted">
              {data.cards.length} {plural(data.cards.length, "carta", "cartas")}
              {segView ? " (jogador + arquétipo)" : ""} · {data.totalMatches}{" "}
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
                : `${segView ? "Nenhuma carta" : "Nenhum jogador"} com ${minMatches} ${plural(minMatches, "jogo", "jogos")} no período`
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
            label={segView ? "Cartas por jogador e arquétipo" : "Cartas dos jogadores"}
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
          archetypeFilterId={archetypeId}
          onFilterArchetype={(id) => {
            setDetailKey(null);
            setArchFilter({ positionGroup, archetypeId: id });
          }}
        />
      )}
    </PageShell>
  );
}
