import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useClub } from "../hooks/useClub.tsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalAnalysisPlayer {
  name: string;
  goals: number;
  assists: number;
  preAssists: number;
  total: number;
}

interface GoalAnalysisPair {
  from: string;
  to: string;
  count: number;
}

interface GoalAnalysisTrio {
  pre: string;
  assist: string;
  scorer: string;
  count: number;
}

interface GoalAnalysisLink {
  matchId: number;
  matchTimestamp: string;
  scorerName: string;
  assistName: string | null;
  preAssistName: string | null;
}

interface GoalAnalysisResponse {
  clubId: number;
  from: string;
  to: string;
  totalMatches: number;
  totalGoals: number;
  linkedGoals: number;
  totalAssists: number;
  totalPreAssists: number;
  players: GoalAnalysisPlayer[];
  pairs: GoalAnalysisPair[];
  trios: GoalAnalysisTrio[];
  goalLinks: GoalAnalysisLink[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = [
  { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300",    dot: "bg-blue-500",    bar: "bg-blue-500"    },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-300",  dot: "bg-violet-500",  bar: "bg-violet-500"  },
  { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",   dot: "bg-amber-500",   bar: "bg-amber-500"   },
  { bg: "bg-rose-100",    text: "text-rose-800",    border: "border-rose-300",    dot: "bg-rose-500",    bar: "bg-rose-500"    },
  { bg: "bg-cyan-100",    text: "text-cyan-800",    border: "border-cyan-300",    dot: "bg-cyan-500",    bar: "bg-cyan-500"    },
  { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300",  dot: "bg-orange-500",  bar: "bg-orange-500"  },
  { bg: "bg-pink-100",    text: "text-pink-800",    border: "border-pink-300",    dot: "bg-pink-500",    bar: "bg-pink-500"    },
  { bg: "bg-teal-100",    text: "text-teal-800",    border: "border-teal-300",    dot: "bg-teal-500",    bar: "bg-teal-500"    },
  { bg: "bg-indigo-100",  text: "text-indigo-800",  border: "border-indigo-300",  dot: "bg-indigo-500",  bar: "bg-indigo-500"  },
];

function buildColorMap(players: GoalAnalysisPlayer[]): Map<string, number> {
  const map = new Map<string, number>();
  players.forEach((p, i) => map.set(p.name, i));
  return map;
}

function getC(idx: number) { return PALETTE[idx % PALETTE.length]; }

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildMatrix(links: GoalAnalysisLink[], players: string[]) {
  const idx = new Map(players.map((p, i) => [p, i]));
  const n = players.length;
  const mat: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const l of links) {
    if (l.assistName) {
      const f = idx.get(l.assistName), t = idx.get(l.scorerName);
      if (f !== undefined && t !== undefined) mat[f][t]++;
    }
    if (l.preAssistName && l.assistName) {
      const f = idx.get(l.preAssistName), t = idx.get(l.assistName);
      if (f !== undefined && t !== undefined) mat[f][t]++;
    }
  }
  return mat;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Pill: React.FC<{ name: string; colorIdx: number; icon?: string }> = ({ name, colorIdx, icon }) => {
  const c = getC(colorIdx);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}>
      {icon && <span>{icon}</span>}{name}
    </span>
  );
};

const KpiCard: React.FC<{ icon: string; label: string; value: number | string; sub?: string; dark?: boolean }> = ({ icon, label, value, sub, dark }) => (
  <div className={`rounded-xl border p-4 flex flex-col gap-1 ${dark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"}`}>
    <div className="text-xl">{icon}</div>
    <div className={`text-3xl font-black tabular-nums ${dark ? "text-white" : "text-gray-900"}`}>{value}</div>
    <div className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</div>
    {sub && <div className={`text-[11px] ${dark ? "text-gray-500" : "text-gray-400"}`}>{sub}</div>}
  </div>
);

interface LeaderboardProps {
  title: string; icon: string; players: GoalAnalysisPlayer[];
  valueKey: "goals" | "assists" | "preAssists"; colorMap: Map<string, number>;
}
const Leaderboard: React.FC<LeaderboardProps> = ({ title, icon, players, valueKey, colorMap }) => {
  const sorted = [...players].filter(p => p[valueKey] > 0).sort((a, b) => b[valueKey] - a[valueKey]);
  const max = sorted[0]?.[valueKey] ?? 1;
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 min-w-0">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="font-semibold text-gray-800 text-sm">{title}</span>
      </div>
      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-400 text-center">Sem dados</div>
      ) : (
        <div className="divide-y">
          {sorted.slice(0, 8).map((p, i) => {
            const c = getC(colorMap.get(p.name) ?? i);
            const pct = Math.round((p[valueKey] / max) * 100);
            return (
              <div key={p.name} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 w-4 text-right font-medium">{i + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{p.name}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{p[valueKey]}</span>
                </div>
                <div className="ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeResponses(responses: GoalAnalysisResponse[]): GoalAnalysisResponse {
  if (responses.length === 1) return responses[0];

  const allLinks = responses.flatMap(r => r.goalLinks);

  // Re-aggregate players from merged links
  const playerMap = new Map<string, GoalAnalysisPlayer>();
  const get = (name: string): GoalAnalysisPlayer => {
    if (!playerMap.has(name)) playerMap.set(name, { name, goals: 0, assists: 0, preAssists: 0, total: 0 });
    return playerMap.get(name)!;
  };
  for (const l of allLinks) {
    get(l.scorerName).goals++;
    get(l.scorerName).total++;
    if (l.assistName)    { get(l.assistName).assists++;    get(l.assistName).total++;    }
    if (l.preAssistName) { get(l.preAssistName).preAssists++; get(l.preAssistName).total++; }
  }
  const players = Array.from(playerMap.values()).sort((a, b) => b.total - a.total || b.goals - a.goals);

  // Re-aggregate pairs
  const pairMap = new Map<string, GoalAnalysisPair>();
  for (const l of allLinks) {
    if (!l.assistName) continue;
    const key = `${l.assistName}→${l.scorerName}`;
    if (!pairMap.has(key)) pairMap.set(key, { from: l.assistName, to: l.scorerName, count: 0 });
    pairMap.get(key)!.count++;
  }
  const pairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count);

  // Re-aggregate trios
  const trioMap = new Map<string, GoalAnalysisTrio>();
  for (const l of allLinks) {
    if (!l.preAssistName || !l.assistName) continue;
    const key = `${l.preAssistName}→${l.assistName}→${l.scorerName}`;
    if (!trioMap.has(key)) trioMap.set(key, { pre: l.preAssistName, assist: l.assistName, scorer: l.scorerName, count: 0 });
    trioMap.get(key)!.count++;
  }
  const trios = Array.from(trioMap.values()).sort((a, b) => b.count - a.count);

  return {
    clubId: responses[0].clubId,
    from: responses[0].from,
    to: responses[0].to,
    totalMatches: responses.reduce((s, r) => s + r.totalMatches, 0),
    totalGoals: responses.reduce((s, r) => s + r.totalGoals, 0),
    linkedGoals: allLinks.length,
    totalAssists: allLinks.filter(l => l.assistName).length,
    totalPreAssists: allLinks.filter(l => l.preAssistName).length,
    players,
    pairs,
    trios,
    goalLinks: allLinks.sort((a, b) => new Date(b.matchTimestamp).getTime() - new Date(a.matchTimestamp).getTime()),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GoalAnalytics() {
  const { club, selectedClubIds } = useClub();

  const now = new Date();
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<GoalAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeClubIds = useMemo(() => {
    const ids = selectedClubIds.length > 0 ? selectedClubIds : (club?.clubId ? [club.clubId] : []);
    return ids;
  }, [selectedClubIds, club]);

  const fetch = useCallback(async () => {
    if (activeClubIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all(
        activeClubIds.map(id =>
          api.get<GoalAnalysisResponse>(API_ENDPOINTS.CLUB_GOAL_ANALYSIS(id, from, to))
            .then(r => r.data)
        )
      );
      setData(mergeResponses(responses));
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar análise");
    } finally {
      setLoading(false);
    }
  }, [activeClubIds, from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  const colorMap = useMemo(() => data ? buildColorMap(data.players) : new Map(), [data]);

  const matrixPlayers = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    for (const l of data.goalLinks) {
      names.add(l.scorerName);
      if (l.assistName) names.add(l.assistName);
      if (l.preAssistName) names.add(l.preAssistName);
    }
    return Array.from(names);
  }, [data]);

  const matrix = useMemo(() => buildMatrix(data?.goalLinks ?? [], matrixPlayers), [data, matrixPlayers]);
  const maxMatrixVal = useMemo(() => Math.max(...matrix.flat(), 1), [matrix]);

  const linkedPct = data && data.totalGoals > 0
    ? Math.round((data.linkedGoals / data.totalGoals) * 100)
    : 0;

  const PRESETS = [
    { label: "7 dias",   days: 7 },
    { label: "30 dias",  days: 30 },
    { label: "90 dias",  days: 90 },
    { label: "Este ano", days: 365 },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────

  if (activeClubIds.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">⚽</div>
          <div className="font-semibold">Nenhum clube selecionado</div>
          <div className="text-sm mt-1">Selecione um clube no menu superior para ver a análise.</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Análise de Gols</h1>
          <p className="text-sm text-gray-500 mt-0.5">Relações entre gols, assistências e criações de jogadas</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">De</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Até</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={fetch}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Carregando…" : "Aplicar"}
          </button>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => {
                  setFrom(toDateStr(new Date(Date.now() - p.days * 86400000)));
                  setTo(toDateStr(new Date()));
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium border bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400">
          <div className="animate-pulse text-4xl mb-3">⚽</div>
          <div className="text-sm">Carregando análise…</div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon="📅" label="Partidas"    value={data.totalMatches} dark />
            <KpiCard icon="⚽" label="Gols"        value={data.totalGoals}   dark />
            <KpiCard icon="🔗" label="Vinculados"  value={data.linkedGoals}
              sub={`${linkedPct}% do total`} dark />
            <KpiCard icon="🅰️" label="Assistências" value={data.totalAssists} />
            <KpiCard icon="🎯" label="Pré-Assists"  value={data.totalPreAssists} />
            <KpiCard icon="👥" label="Jogadores"    value={data.players.length} />
          </div>

          {/* ── Top Performers ── */}
          {data.players.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Leaderboard title="Artilheiros"   icon="⚽" players={data.players} valueKey="goals"      colorMap={colorMap} />
              <Leaderboard title="Assistentes"   icon="🅰️" players={data.players} valueKey="assists"    colorMap={colorMap} />
              <Leaderboard title="Criadores"     icon="🎯" players={data.players} valueKey="preAssists" colorMap={colorMap} />
            </div>
          )}

          {/* ── Involvement Ranking ── */}
          {data.players.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Ranking de Participação</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Ordenado por total de envolvimentos em gols</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                      <th className="text-left px-4 py-2.5 font-medium">Jogador</th>
                      <th className="text-center px-3 py-2.5 font-medium">⚽ Gols</th>
                      <th className="text-center px-3 py-2.5 font-medium">🅰️ Assist</th>
                      <th className="text-center px-3 py-2.5 font-medium">🎯 Pré</th>
                      <th className="text-center px-3 py-2.5 font-medium">Total</th>
                      <th className="px-4 py-2.5 w-40" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((p, i) => {
                      const ci = colorMap.get(p.name) ?? i;
                      const c = getC(ci);
                      const maxTotal = data.players[0]?.total ?? 1;
                      const pct = Math.round((p.total / maxTotal) * 100);
                      return (
                        <tr key={p.name} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
                              <span className="font-semibold text-gray-800">{p.name}</span>
                            </div>
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.goals > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold">{p.goals}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.assists > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">{p.assists}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.preAssists > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-800 text-xs font-bold border border-violet-200">{p.preAssists}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                              {p.total}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Connections ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Duplas */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-800">🤝 Duplas (Assist → Gol)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Combinações mais frequentes no período</p>
              </div>
              {data.pairs.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">Sem assistências vinculadas</div>
              ) : (
                <div className="divide-y">
                  {data.pairs.map((pair, i) => {
                    const fromC = getC(colorMap.get(pair.from) ?? 0);
                    const toC = getC(colorMap.get(pair.to) ?? 1);
                    const maxPair = data.pairs[0].count;
                    const pct = Math.round((pair.count / maxPair) * 100);
                    return (
                      <div key={`${pair.from}${pair.to}`} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${fromC.bg} ${fromC.text} ${fromC.border}`}>{pair.from}</span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${toC.bg} ${toC.text} ${toC.border}`}>
                            ⚽ {pair.to}
                          </span>
                          <div className="flex-1" />
                          <span className="text-sm font-bold text-gray-700">{pair.count}×</span>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${fromC.bar}`} style={{ width: `${pct}%` }} />
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
                <h3 className="font-semibold text-gray-800">🔺 Trios (Pré → Assist → Gol)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Sequências completas de três jogadores</p>
              </div>
              {data.trios.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">Sem trios registrados</div>
              ) : (
                <div className="divide-y">
                  {data.trios.map((trio, i) => {
                    const preC = getC(colorMap.get(trio.pre) ?? 0);
                    const asstC = getC(colorMap.get(trio.assist) ?? 1);
                    const scrC = getC(colorMap.get(trio.scorer) ?? 2);
                    const maxTrio = data.trios[0].count;
                    const pct = Math.round((trio.count / maxTrio) * 100);
                    return (
                      <div key={`${trio.pre}${trio.assist}${trio.scorer}`} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${preC.bg} ${preC.text} ${preC.border}`}>{trio.pre}</span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${asstC.bg} ${asstC.text} ${asstC.border}`}>{trio.assist}</span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${scrC.bg} ${scrC.text} ${scrC.border}`}>⚽ {trio.scorer}</span>
                          <div className="flex-1" />
                          <span className="text-sm font-bold text-gray-700">{trio.count}×</span>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${preC.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Pass Matrix ── */}
          {matrixPlayers.length > 1 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-800">🗂️ Matriz de Passes</h3>
                <p className="text-xs text-gray-500 mt-0.5">Linha = quem passou · Coluna = quem recebeu · Acumula pré→assist e assist→gol</p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="w-28 min-w-[112px]" />
                      {matrixPlayers.map(p => {
                        const c = getC(colorMap.get(p) ?? 0);
                        return (
                          <th key={p} className="pb-2 px-1">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${c.bg} ${c.text} ${c.border} whitespace-nowrap max-w-[84px] truncate text-[11px]`}>{p}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {matrixPlayers.map((row, ri) => {
                      const rc = getC(colorMap.get(row) ?? 0);
                      const rowTotal = matrix[ri].reduce((s, v) => s + v, 0);
                      return (
                        <tr key={row}>
                          <td className="pr-3 py-1 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${rc.bg} ${rc.text} ${rc.border} whitespace-nowrap max-w-[108px] truncate text-[11px]`}>{row}</span>
                          </td>
                          {matrixPlayers.map((col, ci) => {
                            const val = matrix[ri][ci];
                            const self = row === col;
                            const intensity = self ? 0 : val / maxMatrixVal;
                            return (
                              <td key={col} className="px-1 py-1">
                                <div
                                  className={`flex items-center justify-center w-10 h-10 rounded-lg mx-auto text-sm font-bold ${
                                    self ? "bg-gray-100 text-gray-300" :
                                    val === 0 ? "text-gray-200" :
                                    intensity >= 0.75 ? "bg-gray-900 text-white" :
                                    intensity >= 0.5  ? "bg-gray-700 text-white" :
                                    intensity >= 0.25 ? "bg-gray-300 text-gray-800" :
                                                        "bg-gray-100 text-gray-600"
                                  }`}
                                  title={self ? "" : `${row} → ${col}: ${val}×`}
                                >
                                  {self ? "·" : val === 0 ? "–" : val}
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-3 py-1">
                            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                              {rowTotal > 0 ? `${rowTotal}p` : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-400">Intensidade:</span>
                  {[
                    { label: "1",  style: "bg-gray-100 text-gray-600" },
                    { label: "2",  style: "bg-gray-300 text-gray-800" },
                    { label: "3",  style: "bg-gray-700 text-white"    },
                    { label: "4+", style: "bg-gray-900 text-white"    },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold ${l.style}`}>{l.label}</div>
                      <span className="text-[11px] text-gray-400">{l.label === "4+" ? "4+ passes" : `${l.label} passe${l.label !== "1" ? "s" : ""}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Colour legend ── */}
          {data.players.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Legenda</h3>
              <div className="flex flex-wrap gap-2">
                {data.players.map(p => {
                  const c = getC(colorMap.get(p.name) ?? 0);
                  return (
                    <span key={p.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Goal History (collapsible) ── */}
          {data.goalLinks.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <button
                onClick={() => setHistoryOpen(v => !v)}
                className="w-full px-4 py-3 border-b bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">📋 Histórico de Gols</h3>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{data.goalLinks.length} gols vinculados</span>
                </div>
                <span className="text-gray-400 text-sm">{historyOpen ? "▲" : "▼"}</span>
              </button>
              {historyOpen && (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {data.goalLinks.map((l, i) => {
                    const scorerIdx = colorMap.get(l.scorerName) ?? 0;
                    const assistIdx = l.assistName ? (colorMap.get(l.assistName) ?? 1) : -1;
                    const preIdx = l.preAssistName ? (colorMap.get(l.preAssistName) ?? 2) : -1;
                    return (
                      <div key={i} className="px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 flex-wrap">
                        <Link
                          to={`/match/${l.matchId}/goals`}
                          className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap transition-colors"
                        >
                          {fmtDate(l.matchTimestamp)}
                        </Link>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {preIdx >= 0 && l.preAssistName && (
                            <>
                              <Pill name={l.preAssistName} colorIdx={preIdx} />
                              <span className="text-gray-300 text-xs">→</span>
                            </>
                          )}
                          {assistIdx >= 0 && l.assistName && (
                            <>
                              <Pill name={l.assistName} colorIdx={assistIdx} />
                              <span className="text-gray-300 text-xs">→</span>
                            </>
                          )}
                          <Pill name={l.scorerName} colorIdx={scorerIdx} icon="⚽" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {data.linkedGoals === 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-gray-500">
              <div className="text-4xl mb-3">🔗</div>
              <div className="font-semibold">Nenhum gol vinculado neste período</div>
              <div className="text-sm mt-1">
                Registre as assistências nas páginas individuais de cada partida para ver as análises aqui.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
