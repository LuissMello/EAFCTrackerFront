import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS, crestUrl, FALLBACK_LOGO } from "../config/urls.ts";
import { ClubStats } from "../types/stats.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiGoal {
  matchGoalLinkId: number;
  matchId: number;
  clubId: number;
  scorerPlayerEntityId: number;
  scorerName: string;
  assistPlayerEntityId: number | null;
  assistName: string | null;
  preAssistPlayerEntityId: number | null;
  preAssistName: string | null;
}

interface ApiGoalsResponse {
  matchId: number;
  totalGoals: number;
  goals: ApiGoal[];
}

interface ClubRow extends ClubStats {
  clubCrestAssetId?: string | null;
}

interface MatchStatisticsResponse {
  clubs: ClubRow[];
}

type TabId = "gols" | "estatisticas" | "conexoes";

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = [
  { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300",    dot: "bg-blue-500"    },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-300",  dot: "bg-violet-500"  },
  { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",   dot: "bg-amber-500"   },
  { bg: "bg-rose-100",    text: "text-rose-800",    border: "border-rose-300",    dot: "bg-rose-500"    },
  { bg: "bg-cyan-100",    text: "text-cyan-800",    border: "border-cyan-300",    dot: "bg-cyan-500"    },
  { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300",  dot: "bg-orange-500"  },
  { bg: "bg-pink-100",    text: "text-pink-800",    border: "border-pink-300",    dot: "bg-pink-500"    },
  { bg: "bg-teal-100",    text: "text-teal-800",    border: "border-teal-300",    dot: "bg-teal-500"    },
  { bg: "bg-indigo-100",  text: "text-indigo-800",  border: "border-indigo-300",  dot: "bg-indigo-500"  },
];

function getPalette(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Assigns a stable palette index to each unique player name across all goals */
function buildColorMap(goals: ApiGoal[]): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const g of goals) {
    for (const name of [g.scorerName, g.assistName, g.preAssistName]) {
      if (name && !map.has(name)) map.set(name, idx++);
    }
  }
  return map;
}

interface PlayerStat {
  name: string;
  goals: number;
  assists: number;
  preAssists: number;
  involvements: number;
}

function buildPlayerStats(goals: ApiGoal[]): PlayerStat[] {
  const map = new Map<string, PlayerStat>();
  const get = (name: string) => {
    if (!map.has(name)) map.set(name, { name, goals: 0, assists: 0, preAssists: 0, involvements: 0 });
    return map.get(name)!;
  };
  for (const g of goals) {
    get(g.scorerName).goals++;
    get(g.scorerName).involvements++;
    if (g.assistName) { get(g.assistName).assists++; get(g.assistName).involvements++; }
    if (g.preAssistName) { get(g.preAssistName).preAssists++; get(g.preAssistName).involvements++; }
  }
  return Array.from(map.values()).sort((a, b) => b.involvements - a.involvements || b.goals - a.goals);
}

interface PairStat { from: string; to: string; count: number }
interface TrioStat { pre: string; assist: string; scorer: string; count: number }

function buildConnections(goals: ApiGoal[]) {
  const pairMap = new Map<string, PairStat>();
  const trioMap = new Map<string, TrioStat>();

  for (const g of goals) {
    if (g.assistName) {
      const key = `${g.assistName}→${g.scorerName}`;
      if (!pairMap.has(key)) pairMap.set(key, { from: g.assistName, to: g.scorerName, count: 0 });
      pairMap.get(key)!.count++;
    }
    if (g.preAssistName && g.assistName) {
      const key = `${g.preAssistName}→${g.assistName}→${g.scorerName}`;
      if (!trioMap.has(key))
        trioMap.set(key, { pre: g.preAssistName, assist: g.assistName, scorer: g.scorerName, count: 0 });
      trioMap.get(key)!.count++;
    }
  }

  const pairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count);
  const trios = Array.from(trioMap.values()).sort((a, b) => b.count - a.count);
  return { pairs, trios };
}

/** Builds pass-flow matrix: how many times player A "fed" player B (preAssist→assist + assist→scorer) */
function buildMatrix(goals: ApiGoal[], players: string[]) {
  const idx = new Map(players.map((p, i) => [p, i]));
  const n = players.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const g of goals) {
    if (g.assistName) {
      const from = idx.get(g.assistName);
      const to = idx.get(g.scorerName);
      if (from !== undefined && to !== undefined) matrix[from][to]++;
    }
    if (g.preAssistName && g.assistName) {
      const from = idx.get(g.preAssistName);
      const to = idx.get(g.assistName);
      if (from !== undefined && to !== undefined) matrix[from][to]++;
    }
  }
  return matrix;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = "h-5 w-full" }) => (
  <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
);

interface PlayerPillProps { name: string; colorIdx: number; label?: string; icon?: string }
const PlayerPill: React.FC<PlayerPillProps> = ({ name, colorIdx, label, icon }) => {
  const c = getPalette(colorIdx);
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      {label && <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>}
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border} whitespace-nowrap max-w-[140px] truncate`}>
        {icon && <span>{icon}</span>}
        {name}
      </span>
    </div>
  );
};

interface GoalCardProps { goal: ApiGoal; index: number; colorMap: Map<string, number> }
const GoalCard: React.FC<GoalCardProps> = ({ goal, index, colorMap }) => {
  const scorerIdx = colorMap.get(goal.scorerName) ?? 0;
  const assistIdx = goal.assistName ? (colorMap.get(goal.assistName) ?? 1) : -1;
  const preIdx = goal.preAssistName ? (colorMap.get(goal.preAssistName) ?? 2) : -1;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
          {index + 1}
        </span>
        <span className="text-sm font-semibold text-gray-700">Gol {index + 1}</span>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        {preIdx >= 0 && goal.preAssistName ? (
          <>
            <PlayerPill name={goal.preAssistName} colorIdx={preIdx} label="Pré-Assist" />
            <span className="text-gray-400 text-sm pb-4">→</span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-gray-300 uppercase tracking-wide">Pré-Assist</span>
            <span className="px-2.5 py-1 rounded-full text-xs border border-dashed border-gray-200 text-gray-300 whitespace-nowrap">—</span>
          </div>
        )}

        {assistIdx >= 0 && goal.assistName ? (
          <>
            <PlayerPill name={goal.assistName} colorIdx={assistIdx} label="Assist" />
            <span className="text-gray-400 text-sm pb-4">→</span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-gray-300 uppercase tracking-wide">Assist</span>
            <span className="px-2.5 py-1 rounded-full text-xs border border-dashed border-gray-200 text-gray-300 whitespace-nowrap">—</span>
          </div>
        )}

        <PlayerPill name={goal.scorerName} colorIdx={scorerIdx} label="Gol" icon="⚽" />
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatchGoalAnalysis() {
  const { matchId } = useParams<{ matchId: string }>();

  const [goalsData, setGoalsData] = useState<ApiGoalsResponse | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("gols");

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<ApiGoalsResponse>(API_ENDPOINTS.MATCH_GOALS(matchId)),
      api.get<MatchStatisticsResponse>(API_ENDPOINTS.MATCH_STATISTICS(matchId)),
    ])
      .then(([goalsRes, statsRes]) => {
        if (cancelled) return;
        setGoalsData(goalsRes.data);
        setMatchStats(statsRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Erro ao carregar dados da partida.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [matchId]);

  const goals = useMemo(() => goalsData?.goals ?? [], [goalsData]);
  const clubs = useMemo(() => matchStats?.clubs ?? [], [matchStats]);

  const colorMap = useMemo(() => buildColorMap(goals), [goals]);
  const playerStats = useMemo(() => buildPlayerStats(goals), [goals]);
  const { pairs, trios } = useMemo(() => buildConnections(goals), [goals]);

  const involvedPlayers = useMemo(() => {
    const names = new Set<string>();
    for (const g of goals) {
      names.add(g.scorerName);
      if (g.assistName) names.add(g.assistName);
      if (g.preAssistName) names.add(g.preAssistName);
    }
    return Array.from(names);
  }, [goals]);

  const matrix = useMemo(() => buildMatrix(goals, involvedPlayers), [goals, involvedPlayers]);
  const maxMatrixVal = useMemo(() => Math.max(...matrix.flat(), 1), [matrix]);

  const goalsByClub = useMemo(() => {
    const map = new Map<number, ApiGoal[]>();
    for (const g of goals) {
      if (!map.has(g.clubId)) map.set(g.clubId, []);
      map.get(g.clubId)!.push(g);
    }
    return map;
  }, [goals]);

  // Match header info
  const clubA = clubs[0];
  const clubB = clubs[1];
  const scoreA = clubA?.totalGoals ?? "–";
  const scoreB = clubB?.totalGoals ?? "–";

  const TABS: { id: TabId; label: string }[] = [
    { id: "gols",         label: "⚽ Gols"         },
    { id: "estatisticas", label: "📊 Estatísticas"  },
    { id: "conexoes",     label: "🔗 Conexões"      },
  ];

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="rounded-xl border p-4 bg-red-50 text-red-800">
          <div className="font-semibold">Erro ao carregar análise</div>
          <div className="text-sm mt-1">{error}</div>
          <Link to={`/match/${matchId}`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm bg-white hover:bg-gray-50">
            ← Voltar para a partida
          </Link>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Link to={`/match/${matchId}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm bg-white shadow-sm hover:bg-gray-50">
          ← Voltar para a partida
        </Link>
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">⚽</div>
          <div className="font-semibold">Nenhum vínculo de gol registrado</div>
          <div className="text-sm mt-1">Registre as assistências na página da partida para ver a análise aqui.</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Back */}
      <div className="flex items-center gap-2">
        <Link
          to={`/match/${matchId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm shadow-sm bg-white hover:bg-gray-50"
        >
          ← Voltar para a partida
        </Link>
        <span className="text-gray-400 text-sm">Análise de Gols</span>
      </div>

      {/* Match Header */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-center gap-6">
          {clubA && (
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <img
                src={crestUrl(clubA.clubCrestAssetId)}
                onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                alt={clubA.clubName}
                className="w-12 h-12 object-contain rounded-full border bg-white"
              />
              <span className="text-sm font-semibold text-gray-800 text-center max-w-[120px] truncate">{clubA.clubName}</span>
            </div>
          )}

          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-gray-800 tabular-nums tracking-tight">
              {scoreA} <span className="text-gray-300">×</span> {scoreB}
            </span>
            <span className="text-xs text-gray-400 mt-1">Partida #{matchId}</span>
          </div>

          {clubB && (
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <img
                src={crestUrl(clubB.clubCrestAssetId)}
                onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                alt={clubB.clubName}
                className="w-12 h-12 object-contain rounded-full border bg-white"
              />
              <span className="text-sm font-semibold text-gray-800 text-center max-w-[120px] truncate">{clubB.clubName}</span>
            </div>
          )}
        </div>

        {/* Quick stat pills */}
        <div className="flex justify-center gap-3 mt-4 flex-wrap">
          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border">
            {goals.length} gol{goals.length !== 1 ? "s" : ""} registrado{goals.length !== 1 ? "s" : ""}
          </span>
          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border">
            {goals.filter((g) => g.assistName).length} assistência{goals.filter((g) => g.assistName).length !== 1 ? "s" : ""}
          </span>
          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border">
            {goals.filter((g) => g.preAssistName).length} pré-assistência{goals.filter((g) => g.preAssistName).length !== 1 ? "s" : ""}
          </span>
          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border">
            {involvedPlayers.length} jogador{involvedPlayers.length !== 1 ? "es" : ""} envolvido{involvedPlayers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border shadow-sm p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GOLS ─────────────────────────────────────────────────────────── */}
      {activeTab === "gols" && (
        <div className="space-y-6">
          {clubs.map((club) => {
            const clubGoals = goalsByClub.get(club.clubId) ?? [];
            if (clubGoals.length === 0) return null;
            return (
              <div key={club.clubId}>
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={crestUrl(club.clubCrestAssetId)}
                    onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                    alt={club.clubName}
                    className="w-6 h-6 rounded-full border bg-white object-contain"
                  />
                  <h3 className="font-semibold text-gray-800">{club.clubName}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">
                    {clubGoals.length} gol{clubGoals.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clubGoals.map((g, i) => (
                    <GoalCard key={g.matchGoalLinkId} goal={g} index={i} colorMap={colorMap} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Goals from clubs not in stats (edge case) */}
          {Array.from(goalsByClub.entries())
            .filter(([clubId]) => !clubs.some((c) => c.clubId === clubId))
            .map(([clubId, clubGoals]) => (
              <div key={clubId}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-gray-800">Clube {clubId}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">
                    {clubGoals.length} gol{clubGoals.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clubGoals.map((g, i) => (
                    <GoalCard key={g.matchGoalLinkId} goal={g} index={i} colorMap={colorMap} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── TAB: ESTATÍSTICAS ─────────────────────────────────────────────────── */}
      {activeTab === "estatisticas" && (
        <div className="space-y-4">
          {/* Participation Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Artilheiros",   value: playerStats.filter((p) => p.goals > 0).length,     icon: "⚽" },
              { label: "Assistentes",   value: playerStats.filter((p) => p.assists > 0).length,   icon: "🅰️" },
              { label: "Pré-Assists",   value: playerStats.filter((p) => p.preAssists > 0).length, icon: "🎯" },
              { label: "Participações", value: goals.length * 1 + goals.filter((g) => g.assistName).length + goals.filter((g) => g.preAssistName).length, icon: "🔢" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border shadow-sm p-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Player Contribution Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">Contribuição por Jogador</h3>
              <p className="text-xs text-gray-500 mt-0.5">Ordenado por total de participações</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Jogador</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">⚽ Gols</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">🅰️ Assists</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">🎯 Pré-Assist</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((p, i) => {
                    const c = getPalette(colorMap.get(p.name) ?? i);
                    return (
                      <tr key={p.name} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 text-xs font-medium">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                            <span className="font-medium text-gray-800">{p.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {p.goals > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold">{p.goals}</span>
                            : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {p.assists > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">{p.assists}</span>
                            : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {p.preAssists > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-800 text-xs font-bold border border-violet-200">{p.preAssists}</span>
                            : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                            {p.involvements}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CONEXÕES ─────────────────────────────────────────────────────── */}
      {activeTab === "conexoes" && (
        <div className="space-y-5">

          {/* Duplas */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">🤝 Top Duplas (Assist → Gol)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Quantas vezes A assistiu B nesta partida</p>
            </div>
            {pairs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma assistência registrada</div>
            ) : (
              <div className="divide-y">
                {pairs.map((p) => {
                  const fromIdx = colorMap.get(p.from) ?? 0;
                  const toIdx = colorMap.get(p.to) ?? 1;
                  const fromC = getPalette(fromIdx);
                  const toC = getPalette(toIdx);
                  return (
                    <div key={`${p.from}-${p.to}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${fromC.bg} ${fromC.text} ${fromC.border}`}>
                        {p.from}
                      </span>
                      <span className="text-gray-400 text-sm">→</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${toC.bg} ${toC.text} ${toC.border}`}>
                        ⚽ {p.to}
                      </span>
                      <div className="flex-1" />
                      <span className="text-sm font-bold text-gray-700">
                        {p.count}×
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: p.count }).map((_, i) => (
                          <span key={i} className={`w-2 h-2 rounded-full ${fromC.dot}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trios */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">🔺 Trios (Pré-Assist → Assist → Gol)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Sequências completas de três jogadores</p>
            </div>
            {trios.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum trio registrado</div>
            ) : (
              <div className="divide-y">
                {trios.map((t) => {
                  const preIdx = colorMap.get(t.pre) ?? 0;
                  const assistIdx = colorMap.get(t.assist) ?? 1;
                  const scorerIdx = colorMap.get(t.scorer) ?? 2;
                  const preC = getPalette(preIdx);
                  const assistC = getPalette(assistIdx);
                  const scorerC = getPalette(scorerIdx);
                  return (
                    <div key={`${t.pre}-${t.assist}-${t.scorer}`} className="flex items-center gap-2 px-4 py-3 flex-wrap hover:bg-gray-50">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${preC.bg} ${preC.text} ${preC.border}`}>
                        {t.pre}
                      </span>
                      <span className="text-gray-400 text-sm">→</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${assistC.bg} ${assistC.text} ${assistC.border}`}>
                        {t.assist}
                      </span>
                      <span className="text-gray-400 text-sm">→</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${scorerC.bg} ${scorerC.text} ${scorerC.border}`}>
                        ⚽ {t.scorer}
                      </span>
                      <div className="flex-1" />
                      <span className="text-sm font-bold text-gray-700">{t.count}×</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connection Matrix */}
          {involvedPlayers.length > 1 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-800">🗂️ Matriz de Passes</h3>
                <p className="text-xs text-gray-500 mt-0.5">Linha = quem passou · Coluna = quem recebeu</p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="w-24 min-w-[96px]" />
                      {involvedPlayers.map((p) => {
                        const c = getPalette(colorMap.get(p) ?? 0);
                        return (
                          <th key={p} className="pb-2 px-1">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${c.bg} ${c.text} ${c.border} whitespace-nowrap max-w-[80px] truncate`}>
                                {p}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {involvedPlayers.map((rowPlayer, ri) => {
                      const rc = getPalette(colorMap.get(rowPlayer) ?? 0);
                      const rowTotal = matrix[ri].reduce((s, v) => s + v, 0);
                      return (
                        <tr key={rowPlayer}>
                          <td className="pr-3 py-1.5 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${rc.bg} ${rc.text} ${rc.border} whitespace-nowrap max-w-[96px] truncate`}>
                              {rowPlayer}
                            </span>
                          </td>
                          {involvedPlayers.map((colPlayer, ci) => {
                            const val = matrix[ri][ci];
                            const isSelf = rowPlayer === colPlayer;
                            const intensity = isSelf ? 0 : val / maxMatrixVal;
                            return (
                              <td key={colPlayer} className="px-1 py-1.5 text-center">
                                <div
                                  className={`flex items-center justify-center w-9 h-9 rounded-lg mx-auto text-sm font-bold transition-colors ${
                                    isSelf
                                      ? "bg-gray-100 text-gray-300"
                                      : val === 0
                                      ? "text-gray-200"
                                      : intensity >= 0.75
                                      ? "bg-gray-900 text-white"
                                      : intensity >= 0.5
                                      ? "bg-gray-700 text-white"
                                      : intensity >= 0.25
                                      ? "bg-gray-300 text-gray-800"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                  title={isSelf ? "" : `${rowPlayer} → ${colPlayer}: ${val}×`}
                                >
                                  {isSelf ? "·" : val === 0 ? "–" : val}
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-3 py-1.5">
                            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                              {rowTotal > 0 ? `${rowTotal} passes` : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500">Intensidade:</span>
                  {[
                    { label: "1 passe", style: "bg-gray-100 text-gray-600" },
                    { label: "2 passes", style: "bg-gray-300 text-gray-800" },
                    { label: "3 passes", style: "bg-gray-700 text-white" },
                    { label: "4+ passes", style: "bg-gray-900 text-white" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded ${l.style} flex items-center justify-center text-[10px] font-bold`}>
                        {l.label.split(" ")[0]}
                      </div>
                      <span className="text-xs text-gray-500">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player colour legend */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Legenda de Jogadores</h3>
            <div className="flex flex-wrap gap-2">
              {involvedPlayers.map((name) => {
                const c = getPalette(colorMap.get(name) ?? 0);
                return (
                  <span key={name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
