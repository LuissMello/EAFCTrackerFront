// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useClub } from "../hooks/useClub.tsx";
import { useMatchResults } from "../hooks/useMatchResults.ts";
import { useGameVersions, gameVersionLabel } from "../hooks/useGameVersions.tsx";
import type { MatchResultDto, MatchTypeFilter, SortKey, RedCardFilter } from "../types/match.ts";
import { perspectiveForSelected, timeValue } from "../utils/matchResults.ts";
import LatestDayPanel from "../components/LatestDayPanel.tsx";
import { Badge, RecordBar } from "../components/match/Badges.tsx";
import { Segmented } from "../components/match/Segmented.tsx";
import { SelectField } from "../components/match/SelectField.tsx";
import { DivisionsSelect } from "../components/match/DivisionsSelect.tsx";
import { PageControls } from "../components/match/PageControls.tsx";
import { MatchCard } from "../components/match/MatchCard.tsx";
import { ScoreboardHero } from "../components/match/ScoreboardHero.tsx";
import { MatchListSkeleton } from "../components/match/Skeleton.tsx";
import { PageHeader, PageShell } from "../components/ui.tsx";

/* ======================
   Página
====================== */
export default function Home() {
  const { club, selectedClubs, selectedClubIds: contextClubIds } = useClub();

  const [searchParams, setSearchParams] = useSearchParams();

  const initialOppDiv = (() => {
    const v = searchParams.get("oppdiv");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
  })();
  const [opponentDivision, setOpponentDivision] = useState<number | null>(initialOppDiv);

  // Seleção múltipla da URL (?clubIds=1,2,3) ou single (?clubId=) ou, por fim, do contexto.
  // A chave em string mantém o array de IDs estável (não muda a cada alteração de outros parâmetros da URL).
  const clubIdsKey = (() => {
    const raw = searchParams.get("clubIds");
    if (raw && raw.trim().length) {
      const ids = raw
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
      if (ids.length) return ids.join(",");
    }
    const single = searchParams.get("clubId");
    if (single && !Number.isNaN(parseInt(single, 10))) return String(parseInt(single, 10));
    return contextClubIds.join(",");
  })();
  const selectedClubIds: number[] = useMemo(
    () => (clubIdsKey ? clubIdsKey.split(",").map(Number) : []),
    [clubIdsKey]
  );

  const fallbackClubName = club?.clubName ?? null;

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [matchType, setMatchType] = useState<MatchTypeFilter>(() => {
    const t = searchParams.get("type");
    return t === "League" || t === "Playoff" ? t : "All";
  });
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = (searchParams.get("sort") || "recent").toLowerCase();
    if (v === "goals" || v === "gf" || v === "goalsfor") return "gf";
    if (v === "ga" || v === "goalsagainst") return "ga";
    if (v === "oldest") return "oldest";
    return "recent";
  });

  const initialRc = (() => {
    const v = searchParams.get("rc");
    if (v === "none") return "none" as RedCardFilter;
    if (v === "1" || v === "1plus") return "1plus" as RedCardFilter;
    if (v === "2" || v === "2plus") return "2plus" as RedCardFilter;
    return "all" as RedCardFilter;
  })();
  const [redFilter, setRedFilter] = useState<RedCardFilter>(initialRc);

  const initialOpp = (() => {
    const v = searchParams.get("opp");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 2 && n <= 11 ? n : null;
  })();
  const [opponentCount, setOpponentCount] = useState<number | null>(initialOpp);

  /** Versão do jogo (?ver=26); null = todas */
  const { versions: gameVersions } = useGameVersions();
  const [gameVersion, setGameVersion] = useState<number | null>(() => {
    const n = Number(searchParams.get("ver"));
    return Number.isInteger(n) && n >= 20 && n <= 99 ? n : null;
  });

  /** Paginação server-side */
  const initialPage = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const initialSize = (() => {
    const n = Number(searchParams.get("size") ?? 30) || 30;
    return Math.min(Math.max(n, 10), 200);
  })();
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialSize);

  // Atalho "/" foca a busca — ignorado quando o foco já está num campo editável
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persistir filtros na URL (inclui paginação)
  useEffect(() => {
    const rcParam = redFilter === "all" ? undefined : redFilter === "none" ? "none" : redFilter === "1plus" ? "1" : "2";

    const oppParam = opponentCount ? String(opponentCount) : undefined;
    const oppDivParam = opponentDivision ? String(opponentDivision) : undefined;

    const next = new URLSearchParams(searchParams.toString());

    if (search) next.set("q", search);
    else next.delete("q");
    if (matchType !== "All") next.set("type", matchType);
    else next.delete("type");
    if (sortKey !== "recent") next.set("sort", sortKey);
    else next.delete("sort");
    if (rcParam) next.set("rc", rcParam);
    else next.delete("rc");
    if (oppParam) next.set("opp", oppParam);
    else next.delete("opp");
    if (oppDivParam) next.set("oppdiv", oppDivParam);
    else next.delete("oppdiv");
    if (gameVersion !== null) next.set("ver", String(gameVersion));
    else next.delete("ver");

    // Padrões (página 1, 30 por página) ficam fora da URL
    if (page !== 1) next.set("page", String(page));
    else next.delete("page");
    if (pageSize !== 30) next.set("size", String(pageSize));
    else next.delete("size");

    const prevStr = searchParams.toString();
    const nextStr = next.toString();
    if (nextStr !== prevStr) {
      setSearchParams(next, { replace: true });
    }
  }, [
    search,
    matchType,
    sortKey,
    redFilter,
    opponentCount,
    opponentDivision,
    gameVersion,
    page,
    pageSize,
    searchParams,
    setSearchParams,
  ]);

  // Reset da página quando a seleção/filtros que afetam a chamada mudam.
  // Feito durante o render (padrão "derived state"): não roda no mount (preserva ?page= da URL) e a
  // página já vem resetada no mesmo commit em que o novo filtro chega ao efeito de busca (uma única requisição).
  const filterKey = `${clubIdsKey}|${matchType}|${opponentCount ?? ""}|${gameVersion ?? ""}|${debouncedSearch.trim()}|${redFilter}|${opponentDivision ?? ""}|${sortKey}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const {
    results,
    loading,
    error,
    refresh,
    totalCount,
    totalPages,
    hasNext,
    hasPrev,
    isServerPaged,
    visible,
    setVisible,
  } = useMatchResults({ selectedClubIds, matchType, opponentCount, gameVersion, search: debouncedSearch, redFilter, opponentDivision, sort: sortKey, page, pageSize, filterKey });

  // Filtros/ordenação em memória (sobre os itens da página carregada)
  const filtered = useMemo(() => {
    if (isServerPaged) return results;
    const term = search.trim().toLowerCase();

    const byText = (m: MatchResultDto) => (term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true);

    const byReds = (m: MatchResultDto) => {
      const redsA = m.clubASummary?.redCards ?? m.clubARedCards ?? 0;
      const redsB = m.clubBSummary?.redCards ?? m.clubBRedCards ?? 0;
      const reds = redsA + redsB;
      if (redFilter === "none") return reds === 0;
      if (redFilter === "1plus") return reds >= 1;
      if (redFilter === "2plus") return reds >= 2;
      return true;
    };

    const byOppCount = (m: MatchResultDto) => {
      if (!opponentCount) return true;
      const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName);
      const opp = p.isMineA ? m.clubBPlayerCount ?? null : m.clubAPlayerCount ?? null;
      return opp === opponentCount;
    };

    const byOppDivision = (m: MatchResultDto) => {
      if (!opponentDivision) return true;
      const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName);
      const oppDiv = p.isMineA ? m.clubBDetails?.currentDivision : m.clubADetails?.currentDivision;
      return oppDiv === opponentDivision;
    };

    const base = results.filter((m) => byText(m) && byReds(m) && byOppCount(m) && byOppDivision(m));

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "recent") {
        const ta = timeValue(a.timestamp, -Infinity);
        const tb = timeValue(b.timestamp, -Infinity);
        return tb - ta;
      }
      if (sortKey === "oldest") {
        const ta = timeValue(a.timestamp, +Infinity);
        const tb = timeValue(b.timestamp, +Infinity);
        return ta - tb;
      }

      if (sortKey === "gf" || sortKey === "ga") {
        const pa = perspectiveForSelected(a, selectedClubIds, fallbackClubName);
        const pb = perspectiveForSelected(b, selectedClubIds, fallbackClubName);
        const va = sortKey === "gf" ? pa.myGoals : pa.oppGoals;
        const vb = sortKey === "gf" ? pb.myGoals : pb.oppGoals;
        if (vb !== va) return vb - va;
        const ta = timeValue(a.timestamp, -Infinity);
        const tb = timeValue(b.timestamp, -Infinity);
        return tb - ta;
      }

      const ta = timeValue(a.timestamp, -Infinity);
      const tb = timeValue(b.timestamp, -Infinity);
      return tb - ta;
    });

    return sorted;
  }, [results, search, sortKey, redFilter, opponentCount, opponentDivision, selectedClubIds, fallbackClubName, isServerPaged]);

  // Resumo
  const summary = useMemo(() => {
    const s = filtered.reduce(
      (acc, m) => {
        const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName);
        acc.jogos++;
        acc.golsPro += p.myGoals;
        acc.golsContra += p.oppGoals;
        if (p.myGoals > p.oppGoals) acc.v++;
        else if (p.myGoals < p.oppGoals) acc.d++;
        else acc.e++;
        const redsA = m.clubASummary?.redCards ?? m.clubARedCards ?? 0;
        const redsB = m.clubBSummary?.redCards ?? m.clubBRedCards ?? 0;
        acc.cartoes += redsA + redsB;
        return acc;
      },
      { jogos: 0, v: 0, e: 0, d: 0, golsPro: 0, golsContra: 0, cartoes: 0 }
    );
    return { ...s, saldo: s.golsPro - s.golsContra };
  }, [filtered, selectedClubIds, fallbackClubName]);

  // "Último resultado": a partida mais recente entre as exibidas (independe da ordenação escolhida).
  // Só na primeira página — nas seguintes o "mais recente" da página não é o último resultado do clube.
  const latest = useMemo(() => {
    let best: MatchResultDto | null = null;
    let bestT = -Infinity;
    for (const m of filtered) {
      const t = timeValue(m.timestamp, -Infinity);
      if (best === null || t > bestT) {
        best = m;
        bestT = t;
      }
    }
    return best;
  }, [filtered]);

  const hasSelection = selectedClubIds.length > 0;
  const hasResults = filtered.length > 0;

  // Filtros aplicados apenas no cliente (sobre a página carregada)
  const clientFiltersActive = !isServerPaged && (search.trim() !== "" || redFilter !== "all" || opponentDivision !== null || sortKey !== "recent");
  const anyFilterActive =
    search.trim() !== "" || redFilter !== "all" || opponentDivision !== null || !!opponentCount || sortKey !== "recent" || gameVersion !== null || matchType !== "All";

  // Mobile: bloco de filtros recolhido + resumo de uma linha
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount =
    (search.trim() !== "" ? 1 : 0) +
    (matchType !== "All" ? 1 : 0) +
    (redFilter !== "all" ? 1 : 0) +
    (opponentCount ? 1 : 0) +
    (opponentDivision !== null ? 1 : 0) +
    (gameVersion !== null ? 1 : 0) +
    (sortKey !== "recent" ? 1 : 0);
  const filtersSummary = (() => {
    const parts: string[] = [matchType === "League" ? "Liga" : matchType === "Playoff" ? "Playoff" : "Todos os tipos"];
    if (search.trim()) parts.push(`busca “${search.trim()}”`);
    if (redFilter !== "all") parts.push(`verm. ${redFilter === "none" ? "nenhum" : redFilter === "1plus" ? "1+" : "2+"}`);
    if (opponentCount) parts.push(`adv. ${opponentCount} jog.`);
    if (opponentDivision !== null) parts.push(`div. ${opponentDivision}`);
    if (gameVersion !== null) parts.push(gameVersionLabel(gameVersion));
    if (sortKey !== "recent") parts.push(sortKey === "oldest" ? "mais antigas" : sortKey === "gf" ? "mais gols feitos" : "mais gols recebidos");
    return parts.join(" · ");
  })();

  const headerRight = hasSelection ? (
    selectedClubIds.length > 1 ? (
      <>
        Clubes atuais: <span className="font-medium">{selectedClubIds.map((id) => selectedClubs.find((c) => c.clubId === id)?.clubName || id).join(", ")}</span>
      </>
    ) : (
      <>
        Clube atual: <span className="font-medium">{fallbackClubName || selectedClubIds[0]}</span>
      </>
    )
  ) : (
    <>Selecione clubes no topo para carregar os resultados.</>
  );

  // Paginação server-side
  const goTo = (p: number) => setPage(Math.max(1, Math.min(totalPages || 1, p)));
  const next = () => hasNext && setPage((p) => p + 1);
  const prev = () => hasPrev && setPage((p) => Math.max(1, p - 1));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Partidas"
        title="Resultados das partidas"
        subtitle={headerRight}
        actions={
          hasResults ? (
            <div className="flex flex-col items-start gap-1.5">
              <span className="hidden sm:inline text-xs text-fg-muted">Resumo das {summary.jogos} partidas exibidas nesta página</span>
              <div className="flex items-center flex-wrap gap-3">
                <RecordBar wins={summary.v} draws={summary.e} losses={summary.d} />
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  <Badge>
                    GP: <span className="tabular-nums ml-1">{summary.golsPro}</span>
                  </Badge>
                  <Badge>
                    GC: <span className="tabular-nums ml-1">{summary.golsContra}</span>
                  </Badge>
                  <Badge color={summary.saldo >= 0 ? "green" : "red"}>
                    Saldo: <span className="tabular-nums ml-1">{summary.saldo >= 0 ? "+" : ""}{summary.saldo}</span>
                  </Badge>
                  {summary.cartoes > 0 && (
                    <Badge color="red">
                      🟥 <span className="tabular-nums ml-1">{summary.cartoes}</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Placar em destaque */}
      {latest && page === 1 && sortKey === "recent" && (
        <div className={`mb-4 transition-opacity ${loading ? "opacity-70" : ""}`}>
          <ScoreboardHero
            m={latest}
            matchType={matchType}
            selectedClubIds={selectedClubIds}
            fallbackClubName={fallbackClubName}
          />
        </div>
      )}

      {/* Acompanhamento do dia (último dia de /statisticsbydate) */}
      {hasSelection && (
        <div className="mb-4">
          <LatestDayPanel clubIds={selectedClubIds} showAllVersions={gameVersion !== null} />
        </div>
      )}

      {/* Toolbar */}
      <div className="sm:sticky sm:top-[calc(var(--nav-h,52px)+0.5rem)] z-20 rounded-xl border border-border bg-surface-raised/95 backdrop-blur px-3 py-2 sm:py-3">
        {/* Mobile: filtros recolhidos por padrão, com resumo em uma linha */}
        <div className="sm:hidden flex items-center gap-2">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="home-filters"
            onClick={() => setFiltersOpen((v) => !v)}
            className="btn btn-secondary h-10 px-3"
          >
            Filtros
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg">{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{filtersSummary}</span>
        </div>

        <div id="home-filters" className={`${filtersOpen ? "mt-2.5 flex" : "hidden"} sm:mt-0 sm:flex flex-col gap-2.5`}>
          {/* Linha 1: tipo de partida + busca */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <Segmented value={matchType} onChange={setMatchType} />

            <div className="relative w-full sm:flex-1 sm:min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                ref={searchRef}
                id="search"
                type="text"
                aria-label="Buscar clube A ou B"
                placeholder="Buscar clube (atalho: /)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-surface-sunken pl-9 pr-8 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-secondary"
                  onClick={() => setSearch("")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Linha 2: filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wide text-fg-subtle mr-0.5">
              Filtros
            </span>

            <SelectField
              label="Verm."
              title="Filtrar por cartões vermelhos"
              active={redFilter !== "all"}
              value={redFilter}
              onChange={(e) => setRedFilter(e.target.value as RedCardFilter)}
            >
              <option value="all">Todos</option>
              <option value="none">Nenhum</option>
              <option value="1plus">1+</option>
              <option value="2plus">2+</option>
            </SelectField>

            <SelectField
              label="Jog. adv."
              title="Filtrar pela quantidade de jogadores do adversário"
              active={!!opponentCount}
              value={opponentCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setOpponentCount(null);
                else {
                  const n = Number(v);
                  setOpponentCount(n >= 2 && n <= 11 ? n : null);
                }
              }}
            >
              <option value="">Todos</option>
              {Array.from({ length: 10 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>

            <DivisionsSelect value={opponentDivision} onChange={setOpponentDivision} />

            <SelectField
              label="Versão"
              title="Filtrar pela versão do jogo"
              active={gameVersion !== null}
              value={gameVersion ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setGameVersion(v === "" ? null : Number(v));
              }}
            >
              <option value="">Todas</option>
              {gameVersions.map((v) => (
                <option key={v.version} value={v.version}>
                  {gameVersionLabel(v.version)}
                </option>
              ))}
              {/* Versão vinda da URL que não existe na lista: mantém a seleção visível */}
              {gameVersion !== null && !gameVersions.some((v) => v.version === gameVersion) && (
                <option value={gameVersion}>{gameVersionLabel(gameVersion)}</option>
              )}
            </SelectField>

            <SelectField
              label="Ordenar"
              title="Ordenar resultados"
              active={sortKey !== "recent"}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="gf">Mais gols feitos</option>
              <option value="ga">Mais gols recebidos</option>
            </SelectField>

            {anyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRedFilter("all");
                  setOpponentCount(null);
                  setOpponentDivision(null);
                  setGameVersion(null);
                  setSortKey("recent");
                }}
                className="h-9 inline-flex items-center gap-1 px-2.5 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10 transition"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {clientFiltersActive && (
        <p className="mt-2 text-xs text-fg-muted">Os filtros locais atuam apenas nas partidas carregadas.</p>
      )}

      {loading && results.length > 0 && (
        <div role="status" className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
          <span
            aria-hidden="true"
            className="inline-block w-3 h-3 rounded-full border-2 border-border-strong border-t-fg-secondary animate-spin"
          />
          Atualizando…
        </div>
      )}

      {/* Estados */}
      {loading && results.length === 0 && <MatchListSkeleton />}

      {error && (
        <div className="mt-4 p-3 bg-negative-soft border border-negative/40 text-negative-fg rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && hasSelection && filtered.length === 0 && (
        <div className="mt-4 p-3 bg-surface-raised border rounded text-fg-secondary">
          Nenhum resultado encontrado.
          <ul className="list-disc ml-5 mt-2 text-sm text-fg-muted">
            <li>Verifique a grafia dos clubes.</li>
            <li>Altere o tipo (Todos/Liga/Playoff).</li>
            <li>Ajuste os filtros de cartões, jogadores, divisão ou versão.</li>
          </ul>
        </div>
      )}

      {!hasSelection && (
        <div className="mt-4 p-3 bg-warning-soft border border-warning/40 rounded-lg text-warning-fg">
          Selecione clubes no botão “Selecionar clubes” (no topo da página) para começar.
        </div>
      )}

      {/* Lista */}
      {hasResults && (
        <div
          className={`mt-4 rounded-2xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
          aria-busy={loading}
        >
          {(isServerPaged ? filtered : filtered.slice(0, visible)).map((m) => (
            <MatchCard
              key={m.matchId}
              m={m}
              matchType={matchType}
              selectedClubIds={selectedClubIds}
              fallbackClubName={fallbackClubName}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {isServerPaged ? (
        <PageControls
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onPageSize={(n) => {
            setPageSize(Math.min(Math.max(n, 10), 200));
            setPage(1);
          }}
          onGoTo={goTo}
          onNext={next}
          onPrev={prev}
        />
      ) : (
        filtered.length > 0 &&
        visible < filtered.length && (
          <div className="flex justify-center mt-4">
            <button type="button" className="btn btn-secondary px-4" onClick={() => setVisible((v) => v + 30)}>
              Mostrar mais ({Math.min(filtered.length - visible, 30)})
            </button>
          </div>
        )
      )}

      {/* Rodapé de contagem */}
      {isServerPaged ? (
        <div className="mt-6 text-xs text-fg-muted text-center">
          Página {totalPages ? page : 0} de {totalPages} — {totalCount} partidas.
        </div>
      ) : (
        filtered.length > 0 && (
          <div className="mt-6 text-xs text-fg-muted text-center">
            Exibindo {Math.min(visible, filtered.length)} de {filtered.length} partidas.
          </div>
        )
      )}
    </PageShell>
  );
}
