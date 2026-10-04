// src/pages/PlayerStats.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { classifyStat, calculateShotToGoalConversion } from "../utils/statClassifier.ts";
import { StatWithQuality } from "../components/StatQualityIndicator.tsx";
import { Tooltip } from "../components/Tooltip.tsx";
import { clamp01to100 } from "../utils/number.ts";
import { mapAttr, pick } from "../utils/playerAttributes.ts";
import type { PlayerMatchStats } from "../types/playerAttributes.ts";
import { ATTR_LABELS, GROUPS } from "../utils/playerAttributes.ts";
import { fmtNum, fmtPct } from "../utils/number.ts";
import { Card, ProgressBar, ErrorState } from "../components/AttributeUi.tsx";
import { EmptyState, PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { StatTile } from "../components/playerStats/StatTile.tsx";
import { StatCompare } from "../components/playerStats/StatCompare.tsx";
import { RadarSVG } from "../components/playerStats/RadarSVG.tsx";

/**********************************
 * Tipos (front)
 **********************************/
type RouteParams = {
  matchId?: string;
  playerId?: string;
}

type MatchPlayerStats = {
  id: number;
  playerId: number;
  playerName: string;
  assists: number;
  cleansheetsAny: number;
  cleansheetsDef: number;
  cleansheetsGk: number;
  goals: number;
  goalsConceded: number;
  losses: number;
  mom: boolean;
  namespace: number;
  passAttempts: number;
  passesMade: number;
  passAccuracy: number; // %
  position: string;
  rating: number;
  realtimeGame: string;
  realtimeIdle: string;
  redCards: number;
  saves: number;
  score: number;
  shots: number;
  tackleAttempts: number;
  tacklesMade: number;
  vproAttr: string;
  vproHackReason: string;
  wins: number;
  statistics: PlayerMatchStats | null;
};

type ClubAggregateRow = {
  playerId: number;
  playerName: string;
  clubId: number;

  matchesPlayed: number;
  totalGoals: number;
  totalAssists: number;
  totalShots: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;

  avgRating: number;

  passAccuracyPercent: number;
  tackleSuccessPercent: number;
  goalAccuracyPercent: number;
  winPercent: number;
};

type ClubAttrSnapshot = {
  playerId: number;
  playerName: string;
  stats: PlayerMatchStats | null;
};

/**********************************
 * Helpers
 **********************************/
function mapPlayer(be: any): MatchPlayerStats {
  const statistics = pick<any>(be, "statistics", "Statistics");
  return {
    playerId: pick<number>(be, "playerId", "PlayerId"),
    id: pick<number>(be, "id", "Id"),
    playerName: pick<string>(be, "playerName", "PlayerName"),
    assists: pick(be, "assists", "Assists"),
    cleansheetsAny: pick(be, "cleansheetsAny", "CleansheetsAny"),
    cleansheetsDef: pick(be, "cleansheetsDef", "CleansheetsDef"),
    cleansheetsGk: pick(be, "cleansheetsGk", "CleansheetsGk"),
    goals: pick(be, "goals", "Goals"),
    goalsConceded: pick(be, "goalsConceded", "GoalsConceded"),
    losses: pick(be, "losses", "Losses"),
    mom: pick(be, "mom", "Mom"),
    namespace: pick(be, "namespace", "Namespace"),
    passAttempts: pick(be, "passAttempts", "PassAttempts"),
    passesMade: pick(be, "passesMade", "PassesMade"),
    passAccuracy: pick(be, "passAccuracy", "PassAccuracy"),
    position: pick(be, "position", "Position"),
    rating: pick(be, "rating", "Rating"),
    realtimeGame: pick(be, "realtimeGame", "RealtimeGame"),
    realtimeIdle: pick(be, "realtimeIdle", "RealtimeIdle"),
    redCards: pick(be, "redCards", "RedCards"),
    saves: pick(be, "saves", "Saves"),
    score: pick(be, "score", "Score"),
    shots: pick(be, "shots", "Shots"),
    tackleAttempts: pick(be, "tackleAttempts", "TackleAttempts"),
    tacklesMade: pick(be, "tacklesMade", "TacklesMade"),
    vproAttr: pick(be, "vproAttr", "VproAttr"),
    vproHackReason: pick(be, "vproHackReason", "VproHackReason"),
    wins: pick(be, "wins", "Wins"),
    statistics: mapAttr(statistics),
  };
}

/**********************************
 * Página
 **********************************/
export default function PlayerStatsPage() {
  const { refreshKey } = useRefresh();
  const { matchId, playerId } = useParams<RouteParams>();

  // estado principal do jogador na partida
  const [player, setPlayer] = useState<MatchPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // descobrir clubId do jogador naquele match
  const [clubId, setClubId] = useState<number | null>(null);

  // painéis
  const [nMatchesPerf, setNMatchesPerf] = useState(10); // continua configurável
  const [perfCollapsed, setPerfCollapsed] = useState(true); // inicia minimizado
  const [attrCollapsed, setAttrCollapsed] = useState(true); // inicia minimizado
  const [perfView, setPerfView] = useState<"Top 10" | "Todos">("Top 10");

  // dados comparativos
  const [teamRows, setTeamRows] = useState<ClubAggregateRow[]>([]);
  const [teamAttrs, setTeamAttrs] = useState<ClubAttrSnapshot[]>([]); // snapshots do ÚLTIMO jogo

  // alvo de comparação de atributos: 'avg' (média do time) ou playerId numérico
  const [attrCompareTarget, setAttrCompareTarget] = useState<"avg" | number>("avg");

  /***************
   * Fetch: jogador naquela partida
   ***************/
  useEffect(() => {
    if (!matchId || !playerId) return;
    const controller = new AbortController();
    const { signal } = controller;

    // ao trocar de partida/jogador o clube anterior deixa de valer
    setClubId(null);

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // jogador naquela partida
        const { data } = await api.get(`/api/matches/${matchId}/players/${playerId}/statistics`, {
          signal,
        });
        if (signal.aborted) return;
        setPlayer(mapPlayer(data));

        // descobrir clubId a partir do match (olhando players)
        const { data: matchData } = await api.get(`/api/matches/${matchId}`, { signal });
        if (signal.aborted) return;
        const playersAny: any[] = matchData?.players ?? matchData?.Players ?? [];
        const found = playersAny.find((x: any) => String(pick(x, "id", "Id")) === String(playerId));
        if (found) {
          const cid = pick<number>(found, "clubId", "ClubId");
          setClubId(Number(cid));
        }
      } catch (err: any) {
        if (signal.aborted || isCanceled(err)) return;
        setError(err?.message ?? "Erro ao carregar dados do jogador");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [matchId, playerId, refreshKey]);

  /***************
   * Fetch: agregados (últimas N) quando já temos clubId
   ***************/
  useEffect(() => {
    if (!clubId) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        // desempenho (players aggregate) — N partidas
        const { data: agg } = await api.get(`/api/clubs/${clubId}/players/aggregate?count=${nMatchesPerf}`, {
          signal,
        });
        if (signal.aborted) return;
        const arr: any[] = Array.isArray(agg) ? agg : [];
        const rows = arr.map((r) => ({
          playerId: Number(pick(r, "playerId", "PlayerId")),
          playerName: String(pick(r, "playerName", "PlayerName") ?? ""),
          clubId: Number(pick(r, "clubId", "ClubId") ?? 0),
          matchesPlayed: Number(pick(r, "matchesPlayed", "MatchesPlayed") ?? 0),
          totalGoals: Number(pick(r, "totalGoals", "TotalGoals") ?? 0),
          totalAssists: Number(pick(r, "totalAssists", "TotalAssists") ?? 0),
          totalShots: Number(pick(r, "totalShots", "TotalShots") ?? 0),
          totalPassesMade: Number(pick(r, "totalPassesMade", "TotalPassesMade") ?? 0),
          totalPassAttempts: Number(pick(r, "totalPassAttempts", "TotalPassAttempts") ?? 0),
          totalTacklesMade: Number(pick(r, "totalTacklesMade", "TotalTacklesMade") ?? 0),
          totalTackleAttempts: Number(pick(r, "totalTackleAttempts", "TotalTackleAttempts") ?? 0),
          totalCleanSheets: Number(pick(r, "totalCleanSheets", "TotalCleanSheets") ?? 0),
          totalRedCards: Number(pick(r, "totalRedCards", "TotalRedCards") ?? 0),
          totalSaves: Number(pick(r, "totalSaves", "TotalSaves") ?? 0),
          avgRating: Number(pick(r, "avgRating", "AvgRating") ?? 0),
          passAccuracyPercent: Number(pick(r, "passAccuracyPercent", "PassAccuracyPercent") ?? 0),
          tackleSuccessPercent: Number(pick(r, "tackleSuccessPercent", "TackleSuccessPercent") ?? 0),
          goalAccuracyPercent: Number(pick(r, "goalAccuracyPercent", "GoalAccuracyPercent") ?? 0),
          winPercent: Number(pick(r, "winPercent", "WinPercent") ?? 0),
        })) as ClubAggregateRow[];
        setTeamRows(rows);
      } catch (e) {
        // requisição cancelada/substituída não deve limpar os dados atuais
        if (signal.aborted || isCanceled(e)) return;
        setTeamRows([]);
      }
    })();

    return () => controller.abort();
  }, [clubId, nMatchesPerf, refreshKey]);

  /***************
   * Fetch: atributos do ÚLTIMO jogo do clube (count=1)
   ***************/
  useEffect(() => {
    if (!clubId) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const { data } = await api.get(`/api/clubs/${clubId}/players/attributes?count=1`, {
          signal,
        });
        if (signal.aborted) return;
        const arr: any[] = Array.isArray(data) ? data : [];
        setTeamAttrs(
          arr.map((row: any) => ({
            playerId: Number(pick(row, "playerId", "PlayerId")),
            playerName: String(pick(row, "playerName", "PlayerName") ?? ""),
            stats: mapAttr(pick(row, "statistics", "Statistics")),
          })) as ClubAttrSnapshot[]
        );

        // se o alvo de comparação for um jogador que não veio nesse último jogo, volta para média
        setAttrCompareTarget((prev) => {
          if (prev === "avg") return prev;
          const exists = arr.some((r: any) => String(pick(r, "playerId", "PlayerId")) === String(prev));
          return exists ? prev : "avg";
        });
      } catch (e) {
        if (signal.aborted || isCanceled(e)) return;
        setTeamAttrs([]);
        setAttrCompareTarget("avg");
      }
    })();

    return () => controller.abort();
  }, [clubId, refreshKey]);

  const isGK = useMemo(() => {
    const pos = (player?.position || "").toLowerCase();
    return pos.includes("gk") || pos.includes("gol") || pos.includes("gl") || pos.includes("goalkeeper");
  }, [player?.position]);

  const computedPassAcc = useMemo(() => {
    if (!player) return 0;
    if (Number.isFinite(player.passAccuracy)) return player.passAccuracy;
    if (player.passAttempts > 0) return (player.passesMade / player.passAttempts) * 100;
    return 0;
  }, [player]);

  const groupAverages = useMemo(() => {
    const atts = player?.statistics;
    if (!atts) return [] as { group: string; value: number }[];
    return GROUPS.filter((g) => (g.onlyGK ? isGK : true)).map((g) => {
      const vals = g.keys.map((k) => Number((atts as any)[k])).filter((v) => Number.isFinite(v));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { group: g.name, value: Math.round(avg) };
    });
  }, [player?.statistics, isGK]);

  // jogador vs time (ultimas N) — desempenho
  const perfComparison = useMemo(() => {
    if (!player || teamRows.length === 0) return null;
    const me = teamRows.find((r) => String(r.playerId) === String(player.playerId));
    const base = teamRows;
    const avg = (sel: (r: ClubAggregateRow) => number) => {
      const vals = base.map(sel).filter((v) => Number.isFinite(v));
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return {
      me,
      teamAvg: {
        goals: avg((r) => r.totalGoals),
        assists: avg((r) => r.totalAssists),
        shots: avg((r) => r.totalShots),
        passAcc: avg((r) => r.passAccuracyPercent),
        tackles: avg((r) => r.totalTacklesMade),
        tackAcc: avg((r) => r.tackleSuccessPercent),
        rating: avg((r) => r.avgRating),
        win: avg((r) => r.winPercent),
      },
      sorted: [...teamRows]
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
        .slice(0, perfView === "Top 10" ? 10 : teamRows.length),
    };
  }, [player, teamRows, perfView]);

  // atributos: comparação do SEU snapshot da partida vs alvo (média do time OU jogador específico do último jogo)
  const attrComparison = useMemo(() => {
    const myStats = player?.statistics;
    if (!myStats || teamAttrs.length === 0) return null;

    const keys = Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[];

    // baseline: média do time OU stats de um jogador específico
    let label = "Média do Time";
    let baseline: Partial<Record<keyof PlayerMatchStats, number>> = {};

    if (attrCompareTarget === "avg") {
      const all: PlayerMatchStats[] = teamAttrs.map((t) => t.stats).filter((x): x is PlayerMatchStats => !!x);
      keys.forEach((k) => {
        const vals = all.map((a) => Number((a as any)[k])).filter((v) => Number.isFinite(v));
        baseline[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
    } else {
      const peer = teamAttrs.find((t) => String(t.playerId) === String(attrCompareTarget));
      label = peer?.playerName || "Jogador";
      const s = peer?.stats;
      keys.forEach((k) => {
        baseline[k] = Number((s as any)?.[k]) || 0;
      });
    }

    const myPairs = keys.map((k) => ({
      key: k,
      mine: Number((myStats as any)[k]) || 0,
      peer: baseline[k] || 0,
    }));

    return {
      label,
      list: myPairs,
      topMine: myPairs
        .filter((x) => x.mine > 0)
        .sort((a, b) => b.mine - a.mine)
        .slice(0, 8),
    };
  }, [player?.statistics, teamAttrs, attrCompareTarget]);


  /***************
   * Render
   ***************/
  if (loading) {
    return (
      <PageShell aria-busy>
        <PageHeader eyebrow="Jogador na partida" title="Estatísticas do jogador" subtitle="Carregando…" />
        <Skeleton className="h-24 w-full mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <PageHeader eyebrow="Jogador na partida" title="Estatísticas do jogador" />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </PageShell>
    );
  }
  if (!player) {
    return (
      <PageShell>
        <PageHeader eyebrow="Jogador na partida" title="Estatísticas do jogador" />
        <EmptyState title="Dados indisponíveis">Não foi possível carregar os dados deste jogador.</EmptyState>
      </PageShell>
    );
  }

  const GK = (player?.position || "").toLowerCase().includes("gk");
  const passAcc = computedPassAcc;

  // Calculate additional stats for quality indicators
  const shotToGoalConv = calculateShotToGoalConversion(player.goals, player.shots);
  const tackleSuccessPct = player.tackleAttempts > 0 ? (player.tacklesMade / player.tackleAttempts) * 100 : 0;

  // ? Calculate save percentage for goalkeepers
  const savePct =
    GK && player.saves + player.goalsConceded > 0 ? (player.saves / (player.saves + player.goalsConceded)) * 100 : 0;

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        eyebrow="Jogador na partida"
        title={
          <span className="inline-flex items-center gap-2">
            {player.playerName}
            {player.mom && (
              <Tooltip content="Melhor em Campo">
                <span className="ml-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-fg">
                  MOM
                </span>
              </Tooltip>
            )}
          </span>
        }
        actions={
          <>
            <Link to={`/match/${matchId}`} className="text-accent hover:underline text-sm">
              ← Voltar para a partida
            </Link>
          </>
        }
      />

      {/* RESUMO DA PARTIDA */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-fg">Resumo da Partida</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <StatTile label="Gols" value={fmtNum(player.goals)} />
          <StatTile label="Assistências" value={fmtNum(player.assists)} />
          <StatTile label="Chutes" value={fmtNum(player.shots)} />
          <StatTile label="Passes certos" value={fmtNum(player.passesMade)} />
          <StatTile label="Passes tentados" value={fmtNum(player.passAttempts)} />
          <StatTile label="Precisão de passe" value={fmtPct(passAcc)} statType="passCompletion" rawValue={passAcc} />
          <StatTile label="Desarmes certos" value={fmtNum(player.tacklesMade)} />
          <StatTile label="Desarmes tentados" value={fmtNum(player.tackleAttempts)} />
          {GK && <StatTile label="Defesas" value={fmtNum(player.saves)} />}
          {GK && <StatTile label="Gols sofridos" value={fmtNum(player.goalsConceded)} />}
          {GK && savePct > 0 && (
            <StatTile label="% de defesas" value={fmtPct(savePct)} statType="savePercentage" rawValue={savePct} />
          )}
          <StatTile label="Nota" value={Number.isFinite(player.rating) ? Number(player.rating).toFixed(2) : "0.00"} />
          <StatTile label="Cartões vermelhos" value={fmtNum(player.redCards)} />
          <StatTile label="Score" value={fmtNum(player.score)} />
          <StatTile
            label="Conversão de chutes"
            value={fmtPct(shotToGoalConv)}
            statType="shotToGoalConversion"
            rawValue={shotToGoalConv}
          />
          <StatTile
            label="Sucesso nos desarmes"
            value={fmtPct(tackleSuccessPct)}
            statType="tackleDuelWin"
            rawValue={tackleSuccessPct}
          />
        </div>

        {/* Radar + Highlights de atributos */}
        {groupAverages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <Card>
              <h3 className="text-base font-semibold text-fg mb-3">Médias por Grupo</h3>
              <RadarSVG data={groupAverages} />
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-fg mb-3">Pontos fortes</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(player.statistics ?? {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between rounded-xl border p-2">
                      <span className="text-fg-secondary">{ATTR_LABELS[k as keyof PlayerMatchStats] ?? k}</span>
                      <span className="font-semibold text-fg">{Math.round(Number(v || 0))}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        )}
      </Card>

      {/* PAINEL 1 – Desempenho vs Time (últimas N partidas) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Desempenho vs Time (últimas N partidas)</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fg-secondary">N:</span>
            <select
              value={nMatchesPerf}
              onChange={(e) => setNMatchesPerf(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              value={perfView}
              onChange={(e) => setPerfView(e.target.value as any)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option>Top 10</option>
              <option>Todos</option>
            </select>
            <button
              onClick={() => setPerfCollapsed((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-surface-raised"
            >
              {perfCollapsed ? "Maximizar" : "Minimizar"}
            </button>
          </div>
        </div>

        {!perfCollapsed && (
          <>
            {perfComparison?.me ? (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Eu vs média do time */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Você vs Média do Time</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCompare label="Gols" me={perfComparison.me.totalGoals} team={perfComparison.teamAvg.goals} />
                    <StatCompare
                      label="Assistências"
                      me={perfComparison.me.totalAssists}
                      team={perfComparison.teamAvg.assists}
                    />
                    <StatCompare label="Chutes" me={perfComparison.me.totalShots} team={perfComparison.teamAvg.shots} />
                    <StatCompare
                      label="Passe %"
                      me={perfComparison.me.passAccuracyPercent}
                      team={perfComparison.teamAvg.passAcc}
                      pct
                    />
                    <StatCompare
                      label="Desarmes"
                      me={perfComparison.me.totalTacklesMade}
                      team={perfComparison.teamAvg.tackles}
                    />
                    <StatCompare
                      label="Desarme %"
                      me={perfComparison.me.tackleSuccessPercent}
                      team={perfComparison.teamAvg.tackAcc}
                      pct
                    />
                    <StatCompare
                      label="Nota"
                      me={perfComparison.me.avgRating}
                      team={perfComparison.teamAvg.rating}
                      fixed2
                    />
                    <StatCompare
                      label="Vitórias %"
                      me={perfComparison.me.winPercent}
                      team={perfComparison.teamAvg.win}
                      pct
                    />
                  </div>
                </Card>

                {/* Ranking por Nota (Top X) */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Ranking por Nota</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm border">
                      <thead>
                        <tr className="bg-surface-raised">
                          <th className="p-2 text-left">Jogador</th>
                          <th className="p-2 text-right">Nota</th>
                          <th className="p-2 text-right">Gols</th>
                          <th className="p-2 text-right">Assist.</th>
                          <th className="p-2 text-right">Passe %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfComparison.sorted.map((r) => {
                          const isMe = String(r.playerId) === String(player.playerId);
                          return (
                            <tr key={r.playerId} className={`border-t ${isMe ? "bg-accent/10" : ""}`}>
                              <td className="p-2 text-left">
                                {r.playerName}
                                {isMe && " (Você)"}
                              </td>
                              <td className="p-2 text-right">{(r.avgRating ?? 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{r.totalGoals}</td>
                              <td className="p-2 text-right">{r.totalAssists}</td>
                              <td className="p-2 text-right">{fmtPct(r.passAccuracyPercent)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-fg-muted mt-3">Sem dados suficientes para comparação.</div>
            )}
          </>
        )}
      </Card>

      {/* PAINEL 2 – Atributos vs Time (APENAS último jogo do clube) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atributos – comparação (último jogo)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-fg-secondary">Comparar com:</label>
            <select
              value={String(attrCompareTarget)}
              onChange={(e) => {
                const v = e.target.value;
                setAttrCompareTarget(v === "avg" ? "avg" : Number(v));
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="avg">Média do time</option>
              {teamAttrs
                // opcional: remover o próprio jogador da lista de comparação
                .filter((t) => String(t.playerId) !== String(player.playerId))
                .map((t) => (
                  <option key={t.playerId} value={t.playerId}>
                    {t.playerName || `Jogador ${t.playerId}`}
                  </option>
                ))}
            </select>
            <button
              onClick={() => setAttrCollapsed((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-surface-raised"
            >
              {attrCollapsed ? "Maximizar" : "Minimizar"}
            </button>
          </div>
        </div>

        {!attrCollapsed && (
          <>
            {attrComparison ? (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cards de comparação – TODOS os atributos */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">
                    Você vs <span className="text-fg-secondary">{attrComparison.label}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => {
                      const row = attrComparison.list.find((x) => x.key === key);
                      const label = ATTR_LABELS[key];
                      const mine = clamp01to100(row?.mine ?? 0);
                      const peer = clamp01to100(row?.peer ?? 0);
                      const better = mine >= peer;
                      return (
                        <div key={String(key)} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-fg">{label}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                better ? "bg-positive-soft text-positive-fg" : "bg-surface-sunken text-fg-secondary"
                              }`}
                            >
                              {better ? "Acima" : "Na média/abaixo"}
                            </span>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] text-fg-muted">Você: {Math.round(mine)}</div>
                            <div className="w-full bg-surface-sunken rounded h-2 overflow-hidden">
                              <div className="h-2 bg-accent" style={{ width: `${mine}%` }} />
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] text-fg-muted">
                              {attrComparison.label}: {Math.round(peer)}
                            </div>
                            <div className="w-full bg-surface-sunken rounded h-2 overflow-hidden">
                              <div className="h-2 bg-fg-muted" style={{ width: `${peer}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Seus melhores atributos (snapshot da partida exibida) */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Seus melhores atributos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(attrComparison.topMine || []).map((x) => (
                      <StatTile key={String(x.key)} label={ATTR_LABELS[x.key]} value={Math.round(x.mine)} />
                    ))}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-fg-muted mt-3">Sem dados suficientes para comparação.</div>
            )}
          </>
        )}
      </Card>

      {/* ATRIBUTOS TÉCNICOS (lista completa do jogador) */}
      {player.statistics && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold mb-3 text-fg">Atributos Técnicos (partida)</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-fg-secondary">
            {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => (
              <li key={String(key)} className="col-span-1">
                <ProgressBar value={Number((player.statistics as any)[key]) || 0} label={ATTR_LABELS[key]} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}
