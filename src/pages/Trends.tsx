import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { useClub } from "../hooks/useClub.tsx";
import { API_ENDPOINTS } from "../config/urls.ts";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// =========================
// Types
// =========================

type Result = "W" | "D" | "L";

interface MatchTrendPointDto {
  matchId: number;
  timestamp: string;
  opponentClubId: number;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  result: Result | string;
  shots: number;
  passesMade: number;
  passAttempts: number;
  passAccuracyPercent: number;
  tacklesMade: number;
  tackleAttempts: number;
  tackleSuccessPercent: number;
  avgRating: number;
  momOccurred: boolean;
}

interface ClubTrendsDto {
  clubId: number;
  clubName: string;
  series: MatchTrendPointDto[];
  formLast5: string;
  formLast10: string;
  currentUnbeaten: number;
  currentWins: number;
  currentCleanSheets: number;
  movingAvgPassAcc_5: number[];
  movingAvgRating_5: number[];
  movingAvgTackleAcc_5: number[];
}

interface TopItemDto {
  playerEntityId: number;
  playerId: number;
  playerName: string;
  clubId: number;
  goals: number;
  assists: number;
  preAssists: number;
  matches: number;
  avgRating: number;
  mom: number;
}

// =========================
// Helpers
// =========================

const BR_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const formatDate = (iso: string) => BR_DATE.format(new Date(iso));

const COLORS = {
  blue: { border: "rgba(37,99,235,1)", fill: "rgba(59,130,246,0.15)" },
  emerald: { border: "rgba(16,185,129,1)", fill: "rgba(52,211,153,0.15)" },
  amber: { border: "rgba(245,158,11,1)", fill: "rgba(251,191,36,0.15)" },
  indigo: { border: "rgba(79,70,229,1)", fill: "rgba(129,140,248,0.15)" },
  rose: { border: "rgba(244,63,94,1)", fill: "rgba(251,113,133,0.12)" },
  slate: { border: "rgba(100,116,139,1)", fill: "rgba(148,163,184,0.15)" },
};

const pillColor = (r: Result) => (r === "W" ? "bg-green-600" : r === "D" ? "bg-gray-500" : "bg-red-600");

// média móvel simples
function movingAvg(arr: number[], win = 5) {
  if (!arr || arr.length === 0) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i] ?? 0;
    if (i >= win) sum -= arr[i - win] ?? 0;
    out.push(i >= win - 1 ? sum / win : arr[i]);
  }
  return out;
}

// cor → rgba com alpha
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// hash → cor estável
function colorFromId(num: number) {
  let x = Math.imul(num ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  const r = (x & 0xff).toString(16).padStart(2, "0");
  const g = ((x >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b = ((x >>> 16) & 0xff).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

// =========================
// Component
// =========================

export default function TrendsPage() {
  const { club, selectedClubIds, selectedClubs } = useClub();

  // ids efetivos (multi). Se nenhum selecionado, tenta o single legacy.
  const idsToUse = useMemo<number[]>(
    () => (selectedClubIds?.length ? selectedClubIds : club?.clubId ? [club.clubId] : []),
    [selectedClubIds, club?.clubId]
  );

  const [last, setLast] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // mapas por clube
  const [trendsByClub, setTrendsByClub] = useState<Record<number, ClubTrendsDto>>({});
  const [topsByClub, setTopsByClub] = useState<Record<number, TopItemDto[]>>({});

  // UI state
  type Metric = "pass" | "tackle" | "rating" | "gfga" | "gdiff";
  const [metric, setMetric] = useState<Metric>("pass");
  type ChartKind = "line" | "area" | "bar";
  const [chartKind, setChartKind] = useState<ChartKind>("line");
  const [smooth, setSmooth] = useState(true);
  type XMode = "index" | "date";
  const [xMode, setXMode] = useState<XMode>("index"); // se multi, força "index" abaixo

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -------- Fetch (multi) --------
  useEffect(() => {
    if (!idsToUse.length) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const trendPromises = idsToUse.map((id) =>
          api.get<ClubTrendsDto>(API_ENDPOINTS.TRENDS_CLUB(id, last), { signal: (controller as any).signal })
        );
        const topsPromises = idsToUse.map((id) =>
          api.get<TopItemDto[]>(API_ENDPOINTS.TRENDS_TOP_SCORERS(id, 10), { signal: (controller as any).signal })
        );

        const [trendResArr, topsResArr] = await Promise.all([Promise.all(trendPromises), Promise.all(topsPromises)]);

        if (!mountedRef.current) return;

        const tMap: Record<number, ClubTrendsDto> = {};
        const pMap: Record<number, TopItemDto[]> = {};

        trendResArr.forEach((r) => (tMap[r.data.clubId] = r.data));
        topsResArr.forEach((r, idx) => (pMap[idsToUse[idx]] = r.data));

        setTrendsByClub(tMap);
        setTopsByClub(pMap);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        setError(e?.message ?? "Erro ao carregar tendências");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [idsToUse.join(","), last, reloadNonce]); // join para mudar quando a lista mudar

  // -------- Derived (multi) --------
  const clubsWithData = useMemo(
    () => idsToUse.map((id) => trendsByClub[id]).filter((x): x is ClubTrendsDto => !!x),
    [idsToUse, trendsByClub]
  );

  const singleClub = clubsWithData.length === 1 ? clubsWithData[0] : null;

  // rótulo do topo
  const headerTitle =
    clubsWithData.length <= 1 ? singleClub?.clubName ?? club?.clubName ?? "" : "Vários clubes selecionados";

  // X labels: se multi, força índice; se single, respeita xMode
  const effectiveXMode: XMode = clubsWithData.length > 1 ? "index" : xMode;

  // comprimento máximo para label de índice
  const maxLen = useMemo(() => {
    let m = 0;
    for (const c of clubsWithData) m = Math.max(m, c.series.length);
    return m;
  }, [clubsWithData]);

  const xIndexLabels = useMemo(() => Array.from({ length: maxLen }, (_, i) => `Jogo ${i + 1}`), [maxLen]);

  const xDateLabels = useMemo(() => {
    if (!singleClub) return xIndexLabels; // fallback em multi
    return singleClub.series.map((p) => formatDate(p.timestamp));
  }, [singleClub, xIndexLabels]);

  const xLabels = effectiveXMode === "index" ? xIndexLabels : xDateLabels;

  // ponto pequeno quando há muitos jogos (considera máximo)
  const manyPoints = maxLen > 25;
  const pointRadius = manyPoints ? 0 : 2;

  // construir datasets por métrica
  const chartData = useMemo(() => {
    // helper para pegar valores + smoothing
    const valuesFor = (series: MatchTrendPointDto[], kind: Metric) => {
      if (kind === "pass") return series.map((s) => s.passAccuracyPercent ?? 0);
      if (kind === "tackle") return series.map((s) => s.tackleSuccessPercent ?? 0);
      if (kind === "rating") return series.map((s) => s.avgRating ?? 0);
      if (kind === "gfga")
        return { gf: series.map((s) => s.goalsFor ?? 0), ga: series.map((s) => s.goalsAgainst ?? 0) };
      if (kind === "gdiff") return series.map((s) => (s.goalsFor ?? 0) - (s.goalsAgainst ?? 0));
      return [];
    };

    // métricas simples (uma linha por clube)
    if (metric === "pass" || metric === "tackle" || metric === "rating") {
      const datasets = clubsWithData.map((c) => {
        const baseVals = valuesFor(c.series, metric) as number[];
        const vals = smooth ? movingAvg(baseVals, 5) : baseVals;
        const hex = colorFromId(c.clubId);
        return {
          type: chartKind === "bar" ? "bar" : "line",
          label: c.clubName,
          data: vals,
          borderColor: hex,
          backgroundColor: chartKind === "bar" ? withAlpha(hex, 0.25) : withAlpha(hex, 0.15),
          borderWidth: 2,
          tension: 0.3,
          pointRadius,
          fill: chartKind === "area",
        } as const;
      });

      // pad datasets para mesmo length (Chart.js aceita; valores faltantes como null)
      const padded = datasets.map((ds) => ({
        ...ds,
        data: [...ds.data, ...Array(Math.max(0, maxLen - ds.data.length)).fill(null)],
      }));

      return { labels: xLabels, datasets: padded as any[] };
    }

    // gfga: duas séries por clube (GF e GA)
    if (metric === "gfga") {
      const datasets: any[] = [];
      for (const c of clubsWithData) {
        const base = valuesFor(c.series, "gfga") as { gf: number[]; ga: number[] };
        const gfVals = smooth ? movingAvg(base.gf, 5) : base.gf;
        const gaVals = smooth ? movingAvg(base.ga, 5) : base.ga;
        const hex = colorFromId(c.clubId);

        datasets.push({
          type: chartKind === "bar" ? "bar" : "line",
          label: `${c.clubName} — Gols feitos`,
          data: [...gfVals, ...Array(Math.max(0, maxLen - gfVals.length)).fill(null)],
          borderColor: hex,
          backgroundColor: chartKind === "bar" ? withAlpha(hex, 0.35) : withAlpha(hex, 0.18),
          borderWidth: 2,
          tension: 0.3,
          pointRadius,
          fill: chartKind === "area",
        });
        datasets.push({
          type: chartKind === "bar" ? "bar" : "line",
          label: `${c.clubName} — Gols levados`,
          data: [...gaVals, ...Array(Math.max(0, maxLen - gaVals.length)).fill(null)],
          borderColor: withAlpha(hex, 0.7),
          backgroundColor: chartKind === "bar" ? withAlpha(hex, 0.22) : withAlpha(hex, 0.12),
          borderDash: [6, 3],
          borderWidth: 2,
          tension: 0.3,
          pointRadius,
          fill: chartKind === "area",
        });
      }
      return { labels: xLabels, datasets };
    }

    // gdiff: uma série por clube (barras positivas/negativas ficam com cor via callback)
    if (metric === "gdiff") {
      const datasets = clubsWithData.map((c) => {
        const base = valuesFor(c.series, "gdiff") as number[];
        const vals = smooth ? movingAvg(base, 5) : base;
        const hex = colorFromId(c.clubId);
        const fillColor =
          chartKind === "bar"
            ? (ctx: any) => ((ctx.raw ?? 0) >= 0 ? withAlpha(hex, 0.45) : "rgba(244,63,94,0.45)")
            : withAlpha(hex, 0.2);

        return {
          type: chartKind === "bar" ? "bar" : "line",
          label: `${c.clubName} — Dif. de gols`,
          data: [...vals, ...Array(Math.max(0, maxLen - vals.length)).fill(null)],
          borderColor: hex,
          backgroundColor: fillColor as any,
          borderWidth: 2,
          tension: 0.3,
          pointRadius,
          fill: chartKind === "area",
        } as any;
      });
      return { labels: xLabels, datasets };
    }

    return { labels: xLabels, datasets: [] };
  }, [clubsWithData, metric, chartKind, smooth, xLabels, maxLen, pointRadius]);

  // opções de eixo/tooltip mais limpas
  const baseOptions: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              if (!items?.length) return "";
              const i = items[0].dataIndex ?? 0;

              if (effectiveXMode === "index") {
                return `Jogo ${i + 1}`;
              }

              // single-club + por data
              const s = singleClub?.series?.[i];
              if (!s) return items?.[0]?.label ?? "";
              const date = formatDate(s.timestamp);
              const vs = s.opponentName ? ` vs ${s.opponentName}` : "";
              const placar = ` • ${s.goalsFor}-${s.goalsAgainst}`;
              return `${date}${vs}${placar}`;
            },
            label: (ctx: any) => {
              const v = ctx.raw as number;
              const isRating = metric === "rating";
              return `${ctx.dataset.label}: ${Number.isFinite(v) ? v.toFixed(isRating ? 2 : 1) : "-"}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { callback: (v: any) => `${v}` },
        },
      },
      elements: {
        point: { radius: pointRadius },
        line: { borderJoinStyle: "round", borderCapStyle: "round" },
      },
    }),
    [effectiveXMode, singleClub?.series, pointRadius, metric]
  );

  const ChartComponent =
    metric === "gfga" || metric === "gdiff" ? (chartKind === "bar" ? Bar : Line) : chartKind === "bar" ? Bar : Line;

  const quickLasts = [5, 10, 20, 50];
  const forceReload = () => setReloadNonce(Date.now());

  // =========================
  // Render
  // =========================

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tendências &amp; Streaks — {headerTitle}</h1>
          {idsToUse.length > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              Clubes ativos: <span className="font-mono">{idsToUse.join(", ")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Últimos</span>
          <div className="flex items-center gap-1">
            {quickLasts.map((n) => (
              <button
                key={n}
                onClick={() => setLast(n)}
                className={`text-sm px-2 py-1 rounded border ${
                  last === n ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
                }`}
                aria-pressed={last === n}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24"
            min={5}
            value={last}
            onChange={(e) => setLast(Math.max(5, parseInt(e.target.value) || 5))}
          />
          <span className="text-sm text-gray-700">jogos</span>
          <button
            onClick={forceReload}
            className="ml-2 text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
            title="Recarregar"
          >
            Recarregar
          </button>
        </div>
      </div>

      {idsToUse.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
          Selecione um clube no menu para ver as tendências.
        </div>
      )}

      {idsToUse.length > 0 && loading && (
        <div className="grid gap-3">
          <div className="animate-pulse bg-white border rounded-xl p-4 h-20" />
          <div className="animate-pulse bg-white border rounded-xl p-4 h-24" />
          <div className="animate-pulse bg-white border rounded-xl p-4 h-[340px]" />
          <div className="animate-pulse bg-white border rounded-xl p-4 h-48" />
        </div>
      )}

      {idsToUse.length > 0 && error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={forceReload} className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50">
            Tentar novamente
          </button>
        </div>
      )}

      {idsToUse.length > 0 && !loading && !error && clubsWithData.length > 0 && (
        <>
          {/* Cards - forma e streaks por clube */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {clubsWithData.map((c) => (
              <div key={c.clubId} className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-base font-semibold">{c.clubName}</div>
                  <div className="text-xs text-gray-500">ID {c.clubId}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Forma (Últimos 5)</div>
                    <div className="font-mono tracking-wide">{c.formLast5 || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Forma (Últimos 10)</div>
                    <div className="font-mono tracking-wide">{c.formLast10 || "-"}</div>
                  </div>
                  <div className="grid grid-cols-3 text-center gap-2">
                    <div>
                      <div className="text-[11px] text-gray-500">Sem perder</div>
                      <div className="text-lg font-bold">{c.currentUnbeaten}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500">Vitórias seguidas</div>
                      <div className="text-lg font-bold">{c.currentWins}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500">Clean sheets</div>
                      <div className="text-lg font-bold">{c.currentCleanSheets}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CONTROLES DO GRÁFICO */}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-700">
                Métrica
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as any)}
                >
                  <option value="pass">Precisão de passe (%)</option>
                  <option value="tackle">Êxito em desarmes (%)</option>
                  <option value="rating">Nota média</option>
                  <option value="gfga">Gols feitos × levados</option>
                  <option value="gdiff">Dif. de gols (GF−GA)</option>
                </select>
              </label>

              <label className="text-sm text-gray-700">
                Visual
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={chartKind}
                  onChange={(e) => setChartKind(e.target.value as any)}
                >
                  <option value="line">Linha</option>
                  <option value="area">Área</option>
                  <option value="bar">Barras</option>
                </select>
              </label>

              <label className="text-sm text-gray-700">
                Eixo X
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={effectiveXMode}
                  onChange={(e) => setXMode(e.target.value as any)}
                  disabled={clubsWithData.length > 1}
                  title={clubsWithData.length > 1 ? "Com múltiplos clubes, o eixo por Data é desativado." : ""}
                >
                  <option value="index">Jogo #</option>
                  <option value="date">Data</option>
                </select>
              </label>
            </div>

            {/* GRÁFICO PRINCIPAL */}
            <div className="mt-4 h-[360px]">
              <ChartComponent data={chartData as any} options={baseOptions} />
            </div>

            {/* FAIXA DE RESULTADOS POR CLUBE */}
            <div className="mt-5">
              <div className="text-xs text-gray-500 mb-2">Resultados no período</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {clubsWithData.map((c) => (
                  <div key={c.clubId} className="border rounded-lg p-2">
                    <div className="text-xs font-medium mb-2">{c.clubName}</div>
                    {c.series.length === 0 ? (
                      <div className="text-sm text-gray-600">Sem partidas.</div>
                    ) : (
                      <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                        {c.series.map((s) => (
                          <span
                            key={`${c.clubId}-${s.matchId}`}
                            title={`${formatDate(s.timestamp)} • vs ${s.opponentName} • ${s.goalsFor}-${
                              s.goalsAgainst
                            }`}
                            className={`inline-block w-5 h-5 rounded ${pillColor(s.result as Result)}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top performers (agregado) */}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Top Performers (período)</h2>
              <span className="text-xs text-gray-500">ordenado por gols ↓</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm text-center border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Jogador</th>
                    <th className="p-2 text-left">Clube</th>
                    <th className="p-2">Partidas</th>
                    <th className="p-2">Gols</th>
                    <th className="p-2">Assistências</th>
                    <th className="p-2">Pré-Assist.</th>
                    <th className="p-2">Partic.</th>
                    <th className="p-2">MOM</th>
                    <th className="p-2">Nota média</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(topsByClub)
                    .flatMap(([cid, arr]) =>
                      (arr ?? []).map((t) => ({
                        ...t,
                        _clubId: Number(cid),
                        _clubName:
                          trendsByClub[Number(cid)]?.clubName ??
                          selectedClubs.find((c) => c.clubId === Number(cid))?.clubName ??
                          `Clube ${cid}`,
                      }))
                    )
                    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.avgRating - a.avgRating)
                    .slice(0, 30)
                    .map((t) => (
                      <tr key={`${t._clubId}-${t.playerEntityId}`} className="border-t">
                        <td className="p-2 text-left whitespace-nowrap">{t.playerName}</td>
                        <td className="p-2 text-left whitespace-nowrap">{t._clubName}</td>
                        <td className="p-2">{t.matches}</td>
                        <td className="p-2">{t.goals}</td>
                        <td className="p-2">{t.assists}</td>
                        <td className="p-2">{t.preAssists ?? 0}</td>
                        <td className="p-2 font-medium">{(t.goals ?? 0) + (t.assists ?? 0) + (t.preAssists ?? 0)}</td>
                        <td className="p-2">{t.mom}</td>
                        <td className="p-2">{Number(t.avgRating).toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
