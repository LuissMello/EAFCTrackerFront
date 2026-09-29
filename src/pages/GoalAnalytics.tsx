import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { parseTimestamp, toYmd, daysAgoYmd, fmtDateBR } from "../utils/date.ts";
import { useClubIds } from "../hooks/useClubIds.ts";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { useAbortableFetch } from "../hooks/useAbortableFetch.ts";
import { getPalette as getC, buildPassFlow } from "../utils/goalAnalysis.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalAnalysisPlayer {
  playerId: number;
  name: string;
  goals: number;
  assists: number;
  preAssists: number;
  total: number;
}

interface GoalAnalysisPair {
  fromId: number;
  toId: number;
  from: string;
  to: string;
  count: number;
}

interface GoalAnalysisTrio {
  preId: number;
  assistId: number;
  scorerId: number;
  pre: string;
  assist: string;
  scorer: string;
  count: number;
}

interface GoalAnalysisLink {
  matchId: number;
  matchTimestamp: string;
  scorerId: number;
  assistId: number | null;
  preAssistId: number | null;
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

function buildColorMap(players: GoalAnalysisPlayer[]): Map<number, number> {
  const map = new Map<number, number>();
  players.forEach((p, i) => map.set(p.playerId, i));
  return map;
}
const toDateStr = toYmd; // data local (evita deslocamento de fuso do toISOString)

// ─── Sub-components ───────────────────────────────────────────────────────────

const Pill: React.FC<{ name: string; colorIdx: number; icon?: string }> = ({ name, colorIdx, icon }) => {
  const c = getC(colorIdx);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}>
      {icon && <span>{icon}</span>}{name}
    </span>
  );
};

const KpiCard: React.FC<{ icon: string; label: string; value: number | string; sub?: string; featured?: boolean }> = ({ icon, label, value, sub, featured }) => (
  <div className={`rounded-xl border p-4 flex flex-col gap-1 ${featured ? "bg-accent border-accent text-accent-fg" : "bg-surface border-border"}`}>
    <div className="text-xl">{icon}</div>
    <div className={`text-3xl font-black tabular-nums ${featured ? "text-accent-fg" : "text-fg"}`}>{value}</div>
    <div className={`text-xs font-medium ${featured ? "text-accent-fg/80" : "text-fg-muted"}`}>{label}</div>
    {sub && <div className={`text-[11px] ${featured ? "text-accent-fg/70" : "text-fg-subtle"}`}>{sub}</div>}
  </div>
);

interface LeaderboardProps {
  title: string; icon: string; players: GoalAnalysisPlayer[];
  valueKey: "goals" | "assists" | "preAssists"; colorMap: Map<number, number>;
}
const Leaderboard: React.FC<LeaderboardProps> = ({ title, icon, players, valueKey, colorMap }) => {
  const sorted = [...players].filter(p => p[valueKey] > 0).sort((a, b) => b[valueKey] - a[valueKey]);
  const max = sorted[0]?.[valueKey] ?? 1;
  return (
    <div className="bg-surface rounded-xl border shadow-sm overflow-hidden flex-1 min-w-0">
      <div className="px-4 py-3 border-b bg-surface-raised flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="font-semibold text-fg text-sm">{title}</span>
      </div>
      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-sm text-fg-subtle text-center">Sem dados</div>
      ) : (
        <div className="divide-y">
          {sorted.slice(0, 8).map((p, i) => {
            const c = getC(colorMap.get(p.playerId) ?? i);
            const pct = Math.round((p[valueKey] / max) * 100);
            return (
              <div key={p.playerId} className="px-4 py-2.5 hover:bg-surface-raised transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-fg-subtle w-4 text-right font-medium">{i + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-sm font-medium text-fg flex-1 truncate">{p.name}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{p[valueKey]}</span>
                </div>
                <div className="ml-6 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
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

  // Merge players by summing the stats already aggregated by the backend (from MatchPlayerEntity)
  const playerMap = new Map<number, GoalAnalysisPlayer>();
  for (const r of responses) {
    for (const p of r.players) {
      const existing = playerMap.get(p.playerId);
      if (existing) {
        existing.goals      += p.goals;
        existing.assists    += p.assists;
        existing.preAssists += p.preAssists;
        existing.total      += p.total;
      } else {
        playerMap.set(p.playerId, { ...p });
      }
    }
  }
  const players = Array.from(playerMap.values()).sort((a, b) => b.total - a.total || b.goals - a.goals);

  // Re-aggregate pairs
  const pairMap = new Map<string, GoalAnalysisPair>();
  for (const l of allLinks) {
    if (!l.assistName) continue;
    const key = `${l.assistId}→${l.scorerId}`;
    if (!pairMap.has(key)) pairMap.set(key, { fromId: l.assistId!, toId: l.scorerId, from: l.assistName, to: l.scorerName, count: 0 });
    pairMap.get(key)!.count++;
  }
  const pairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count);

  // Re-aggregate trios
  const trioMap = new Map<string, GoalAnalysisTrio>();
  for (const l of allLinks) {
    if (!l.preAssistName || !l.assistName) continue;
    const key = `${l.preAssistId}→${l.assistId}→${l.scorerId}`;
    if (!trioMap.has(key)) trioMap.set(key, { preId: l.preAssistId!, assistId: l.assistId!, scorerId: l.scorerId, pre: l.preAssistName, assist: l.assistName, scorer: l.scorerName, count: 0 });
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
    goalLinks: allLinks.sort((a, b) => (parseTimestamp(b.matchTimestamp)?.getTime() ?? 0) - (parseTimestamp(a.matchTimestamp)?.getTime() ?? 0)),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GoalAnalytics() {
    const activeClubIds = useClubIds();

    const [from, setFrom] = useState(() => daysAgoYmd(30));
    const [to, setTo] = useState(() => {
      const now = new Date();
      return toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    });
    const [reloadKey, setReloadKey] = useState(0);
    // "Atualizar"/modo ao vivo do cabeçalho
    const { refreshKey } = useRefresh();
  const [loaded, setLoaded] = useState<{ key: string; data: GoalAnalysisResponse } | null>(null);
  const dataKey = `${activeClubIds.join(",")}|${from}|${to}`;
  const data = loaded?.key === dataKey ? loaded.data : null;
  const [historyOpen, setHistoryOpen] = useState(false);

  const { loading, error } = useAbortableFetch(
    async (signal) => {
      const responses = await Promise.all(
        activeClubIds.map(id =>
          api.get<GoalAnalysisResponse>(API_ENDPOINTS.CLUB_GOAL_ANALYSIS(id, from, to), { signal })
            .then(r => r.data)
        )
      );
      if (signal.aborted) return;
      setLoaded({ key: dataKey, data: mergeResponses(responses) });
    },
    [dataKey, reloadKey, refreshKey],
    { enabled: activeClubIds.length > 0, errorMessage: "Erro ao carregar análise" }
  );

  const colorMap = useMemo(() => data ? buildColorMap(data.players) : new Map(), [data]);

  const passFlow = useMemo(() => buildPassFlow(data?.goalLinks ?? []), [data]);

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
        <div className="bg-surface rounded-xl border shadow-sm p-8 text-center text-fg-muted">
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
          <h1 className="text-xl font-black text-fg tracking-tight">Análise de Gols</h1>
          <p className="text-sm text-fg-muted mt-0.5">Relações entre gols, assistências e criações de jogadas</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-surface rounded-xl border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="ga-from" className="text-xs font-medium text-fg-muted uppercase tracking-wide">De</label>
            <input
              id="ga-from"
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ga-to" className="text-xs font-medium text-fg-muted uppercase tracking-wide">Até</label>
            <input
              id="ga-to"
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            disabled={loading}
            className="btn btn-primary px-4"
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
                className="px-3 py-2 rounded-lg text-xs font-medium border bg-surface-raised hover:bg-surface-sunken text-fg-muted transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-negative-soft border border-negative/30 rounded-xl p-4 text-sm text-negative-fg">{error}</div>
      )}

      {loading && (
        <div className="bg-surface rounded-xl border shadow-sm p-12 text-center text-fg-subtle">
          <div className="animate-pulse text-4xl mb-3">⚽</div>
          <div className="text-sm">Carregando análise…</div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon="📅" label="Partidas"    value={data.totalMatches} featured />
            <KpiCard icon="⚽" label="Gols"        value={data.totalGoals}   featured />
            <KpiCard icon="🔗" label="Vinculados"  value={data.linkedGoals}
              sub={`${linkedPct}% do total`} featured />
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
            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-surface-raised flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-fg">Ranking de Participação</h3>
                  <p className="text-xs text-fg-muted mt-0.5">Ordenado por total de envolvimentos em gols</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-surface-raised/50 text-fg-muted text-xs uppercase tracking-wide">
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
                      const ci = colorMap.get(p.playerId) ?? i;
                      const c = getC(ci);
                      const maxTotal = data.players[0]?.total ?? 1;
                      const pct = Math.round((p.total / maxTotal) * 100);
                      return (
                        <tr key={p.playerId} className="border-b last:border-0 hover:bg-surface-raised transition-colors">
                          <td className="px-4 py-3 text-fg-subtle text-xs font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
                              <span className="font-semibold text-fg">{p.name}</span>
                            </div>
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.goals > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-fg text-xs font-bold">{p.goals}</span>
                              : <span className="text-fg-subtle text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.assists > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">{p.assists}</span>
                              : <span className="text-fg-subtle text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {p.preAssists > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-800 text-xs font-bold border border-violet-200">{p.preAssists}</span>
                              : <span className="text-fg-subtle text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                              {p.total}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
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
            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-surface-raised">
                <h3 className="font-semibold text-fg">🤝 Duplas (Assist → Gol)</h3>
                <p className="text-xs text-fg-muted mt-0.5">Combinações mais frequentes no período</p>
              </div>
              {data.pairs.length === 0 ? (
                <div className="px-4 py-8 text-sm text-fg-subtle text-center">Sem assistências vinculadas</div>
              ) : (
                <div className="divide-y">
                  {data.pairs.map((pair, i) => {
                    const fromC = getC(colorMap.get(pair.fromId) ?? 0);
                    const toC = getC(colorMap.get(pair.toId) ?? 1);
                    const maxPair = data.pairs[0].count;
                    const pct = Math.round((pair.count / maxPair) * 100);
                    return (
                      <div key={`${pair.fromId}:${pair.toId}`} className="px-4 py-3 hover:bg-surface-raised transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-fg-subtle w-4 text-right">{i + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${fromC.bg} ${fromC.text} ${fromC.border}`}>{pair.from}</span>
                          <span className="text-fg-subtle text-xs">→</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${toC.bg} ${toC.text} ${toC.border}`}>
                            ⚽ {pair.to}
                          </span>
                          <div className="flex-1" />
                          <span className="text-sm font-bold text-fg-secondary">{pair.count}×</span>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                          <div className={`h-full rounded-full ${fromC.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trios */}
            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-surface-raised">
                <h3 className="font-semibold text-fg">🔺 Trios (Pré → Assist → Gol)</h3>
                <p className="text-xs text-fg-muted mt-0.5">Sequências completas de três jogadores</p>
              </div>
              {data.trios.length === 0 ? (
                <div className="px-4 py-8 text-sm text-fg-subtle text-center">Sem trios registrados</div>
              ) : (
                <div className="divide-y">
                  {data.trios.map((trio, i) => {
                    const preC = getC(colorMap.get(trio.preId) ?? 0);
                    const asstC = getC(colorMap.get(trio.assistId) ?? 1);
                    const scrC = getC(colorMap.get(trio.scorerId) ?? 2);
                    const maxTrio = data.trios[0].count;
                    const pct = Math.round((trio.count / maxTrio) * 100);
                    return (
                      <div key={`${trio.preId}:${trio.assistId}:${trio.scorerId}`} className="px-4 py-3 hover:bg-surface-raised transition-colors">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <span className="text-xs text-fg-subtle w-4 text-right">{i + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${preC.bg} ${preC.text} ${preC.border}`}>{trio.pre}</span>
                          <span className="text-fg-subtle text-xs">→</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${asstC.bg} ${asstC.text} ${asstC.border}`}>{trio.assist}</span>
                          <span className="text-fg-subtle text-xs">→</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${scrC.bg} ${scrC.text} ${scrC.border}`}>⚽ {trio.scorer}</span>
                          <div className="flex-1" />
                          <span className="text-sm font-bold text-fg-secondary">{trio.count}×</span>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                          <div className={`h-full rounded-full ${preC.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Pass Flow ── */}
          {passFlow.length > 0 && (
            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-surface-raised">
                <h3 className="font-semibold text-fg">🔗 Fluxo de Passes</h3>
                <p className="text-xs text-fg-muted mt-0.5">Conexões de pré-assist→assist e assist→gol, ordenadas por frequência</p>
              </div>
              <div className="divide-y">
                {passFlow.map((entry, i) => {
                  const fromC = getC(colorMap.get(entry.fromId ?? 0) ?? 0);
                  const toC = getC(colorMap.get(entry.toId ?? 0) ?? 1);
                  const pct = Math.round((entry.count / passFlow[0].count) * 100);
                  return (
                    <div key={`${entry.fromId}:${entry.toId}`} className="px-4 py-3 hover:bg-surface-raised transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-fg-subtle w-5 text-right font-medium">{i + 1}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${fromC.bg} ${fromC.text} ${fromC.border}`}>{entry.from}</span>
                        <span className="text-fg-subtle text-xs">→</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${toC.bg} ${toC.text} ${toC.border}`}>{entry.to}</span>
                        <div className="flex-1" />
                        <span className="text-sm font-bold text-fg-secondary">{entry.count}×</span>
                      </div>
                      <div className="ml-7 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${fromC.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* ── Goal History (collapsible) ── */}
          {data.goalLinks.length > 0 && (
            <div className="bg-surface rounded-xl border shadow-sm overflow-hidden">
              <button
                onClick={() => setHistoryOpen(v => !v)}
                className="w-full px-4 py-3 border-b bg-surface-raised flex items-center justify-between hover:bg-surface-sunken transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-fg">📋 Histórico de Gols</h3>
                  <span className="text-xs bg-surface-sunken text-fg-muted px-2 py-0.5 rounded-full">{data.goalLinks.length} gols vinculados</span>
                </div>
                <span className="text-fg-subtle text-sm">{historyOpen ? "▲" : "▼"}</span>
              </button>
              {historyOpen && (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {data.goalLinks.map((l, i) => {
                    const scorerIdx = colorMap.get(l.scorerId) ?? 0;
                    const assistIdx = l.assistName ? (colorMap.get(l.assistId ?? 0) ?? 1) : -1;
                    const preIdx = l.preAssistName ? (colorMap.get(l.preAssistId ?? 0) ?? 2) : -1;
                    return (
                      <div key={i} className="px-4 py-2.5 hover:bg-surface-raised flex items-center gap-3 flex-wrap">
                        <Link
                          to={`/match/${l.matchId}/goals`}
                          className="text-xs text-fg-subtle hover:text-fg-secondary underline underline-offset-2 whitespace-nowrap transition-colors"
                        >
                          {fmtDateBR(l.matchTimestamp)}
                        </Link>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {preIdx >= 0 && l.preAssistName && (
                            <>
                              <Pill name={l.preAssistName} colorIdx={preIdx} />
                              <span className="text-fg-subtle text-xs">→</span>
                            </>
                          )}
                          {assistIdx >= 0 && l.assistName && (
                            <>
                              <Pill name={l.assistName} colorIdx={assistIdx} />
                              <span className="text-fg-subtle text-xs">→</span>
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
            <div className="bg-surface rounded-xl border shadow-sm p-10 text-center text-fg-muted">
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
