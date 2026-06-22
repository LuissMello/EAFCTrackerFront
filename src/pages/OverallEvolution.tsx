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
import { Line } from "react-chartjs-2";
import { useClub } from "../hooks/useClub.tsx";
import { API_ENDPOINTS } from "../config/urls.ts";
import OverallSummaryCard, { ClubOverallRow } from "../components/OverallSummaryCard.tsx";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// =========================
// Types
// =========================

interface MatchClubOverallDto {
  clubId: number;
  clubName?: string | null;
  goals: number;
  result: number;
  overallStats?: ClubOverallRow | null;
}

interface MatchWithOverallStatsDto {
  matchId: number;
  date: string;
  ourClub?: MatchClubOverallDto | null;
  opponent?: MatchClubOverallDto | null;
}

interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  items: T[];
}

/** Ponto da série de evolução (ordenado por data, ascendente). */
interface OverallPoint {
  matchId: number;
  date: string;
  ourStats: ClubOverallRow | null;
  oppStats: ClubOverallRow | null;
  oppName: string;
  goalsFor: number;
  goalsAgainst: number;
}

interface ClubSeries {
  clubId: number;
  clubName: string;
  crestAssetId?: string | null;
  points: OverallPoint[];
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

const toNum = (s?: string | null): number => {
  if (s === null || s === undefined) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// cor → rgba com alpha
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// hash → cor estável (mesma função usada em Trends)
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

const pad = (arr: (number | null)[], len: number) => [
  ...arr,
  ...Array(Math.max(0, len - arr.length)).fill(null),
];

type MatchResult = "W" | "D" | "L";
const resultOf = (p: OverallPoint): MatchResult =>
  p.goalsFor > p.goalsAgainst ? "W" : p.goalsFor < p.goalsAgainst ? "L" : "D";

// verde = vitória, amarelo = empate, vermelho = derrota
const RESULT_COLOR: Record<MatchResult, string> = { W: "#16a34a", D: "#ca8a04", L: "#dc2626" };

type SrMarker = { text: string; color: string } | null;

const padMarkers = (arr: SrMarker[], len: number): SrMarker[] => [
  ...arr,
  ...Array(Math.max(0, len - arr.length)).fill(null),
];

/**
 * Desenha a variação de SR (ex.: +5, -1) acima de cada ponto, colorida pelo
 * resultado da partida (verde/amarelo/vermelho). Lê `dataset._markers`
 * (alinhado ao array de dados); datasets sem essa propriedade são ignorados.
 */
const resultMarkersPlugin = {
  id: "resultMarkers",
  afterDatasetsDraw(chart: any) {
    const opt = chart.options?.plugins?.resultMarkers;
    if (!opt?.enabled) return;
    const { ctx } = chart;
    chart.data.datasets.forEach((ds: any, di: number) => {
      const markers: SrMarker[] | undefined = ds._markers;
      if (!markers) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((pt: any, i: number) => {
        const m = markers[i];
        if (!m) return;
        ctx.save();
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = m.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(m.text, pt.x, pt.y - 6);
        ctx.restore();
      });
    });
  },
};

// Partidas antes das 8h contam no dia anterior (sessões que viram a madrugada,
// ex.: 22h→2h, viram uma única "sessão" / dia).
const DAY_CUTOFF_HOUR = 8;
const sessionInstant = (iso: string) => new Date(new Date(iso).getTime() - DAY_CUTOFF_HOUR * 3600_000);

// "dia de sessão" (com cutoff de 8h) usado para agrupar partidas
const dayKey = (iso: string) => {
  const d = sessionInstant(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const DAY_SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const formatDayShort = (iso: string) => DAY_SHORT.format(sessionInstant(iso));

interface DayZone {
  start: number; // índice (na série) da primeira partida do dia
  end: number; // índice da última partida do dia
  label: string; // ex.: "30/05"
  delta: number; // variação líquida de SR no dia
  count: number; // partidas no dia
}

/**
 * Pinta faixas verticais agrupando partidas do mesmo dia (tom verde/vermelho
 * conforme a variação líquida de SR), com separadores e rótulo dia + Δ SR.
 * Lê `chart.options.plugins.dayZones = { enabled, groups }`.
 */
const dayZonesPlugin = {
  id: "dayZones",
  beforeDatasetsDraw(chart: any) {
    const opt = chart.options?.plugins?.dayZones;
    const groups: DayZone[] = opt?.groups ?? [];
    if (!opt?.enabled || !groups.length) return;
    const { ctx, chartArea } = chart;
    const x = chart.scales.x;
    const boundsFor = (g: DayZone, gi: number) => {
      const left =
        gi === 0 ? chartArea.left : (x.getPixelForValue(g.start - 1) + x.getPixelForValue(g.start)) / 2;
      const right =
        gi === groups.length - 1
          ? chartArea.right
          : (x.getPixelForValue(g.end) + x.getPixelForValue(g.end + 1)) / 2;
      return { left, right };
    };
    ctx.save();
    groups.forEach((g, gi) => {
      const { left, right } = boundsFor(g, gi);
      ctx.fillStyle =
        g.delta > 0 ? "rgba(16,185,129,0.08)" : g.delta < 0 ? "rgba(244,63,94,0.08)" : "rgba(148,163,184,0.08)";
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
      if (gi < groups.length - 1) {
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(right, chartArea.top);
        ctx.lineTo(right, chartArea.bottom);
        ctx.stroke();
      }
    });
    ctx.restore();
  },
  afterDatasetsDraw(chart: any) {
    const opt = chart.options?.plugins?.dayZones;
    const groups: DayZone[] = opt?.groups ?? [];
    if (!opt?.enabled || !groups.length) return;
    const { ctx, chartArea } = chart;
    const x = chart.scales.x;
    ctx.save();
    ctx.textAlign = "center";
    groups.forEach((g, gi) => {
      const left =
        gi === 0 ? chartArea.left : (x.getPixelForValue(g.start - 1) + x.getPixelForValue(g.start)) / 2;
      const right =
        gi === groups.length - 1
          ? chartArea.right
          : (x.getPixelForValue(g.end) + x.getPixelForValue(g.end + 1)) / 2;
      const cx = (left + right) / 2;
      if (right - left < 26) return; // estreito demais p/ rótulo
      ctx.font = "600 10px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.textBaseline = "top";
      ctx.fillText(g.label, cx, chartArea.top + 3);
      const deltaText = g.delta > 0 ? `+${g.delta}` : `${g.delta}`;
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = g.delta > 0 ? "#16a34a" : g.delta < 0 ? "#dc2626" : "#6b7280";
      ctx.fillText(`${deltaText} SR`, cx, chartArea.top + 15);
    });
    ctx.restore();
  },
};

// =========================
// Component
// =========================

type Metric = "sr" | "division";
type ChartKind = "line" | "area";

export default function OverallEvolution() {
  const { club, selectedClubIds, selectedClubs } = useClub();

  // ids efetivos (multi). Se nenhum selecionado, tenta o single legacy.
  const idsToUse = useMemo<number[]>(
    () => (selectedClubIds?.length ? selectedClubIds : club?.clubId ? [club.clubId] : []),
    [selectedClubIds, club?.clubId]
  );

  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [seriesByClub, setSeriesByClub] = useState<Record<number, ClubSeries>>({});

  const [metric, setMetric] = useState<Metric>("sr");
  const [chartKind, setChartKind] = useState<ChartKind>("line");
  const [smooth, setSmooth] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [showDayZones, setShowDayZones] = useState(true);
  type XMode = "index" | "date";
  const [xMode, setXMode] = useState<XMode>("date");

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

        const promises = idsToUse.map((id) =>
          api.get<PagedResult<MatchWithOverallStatsDto>>(API_ENDPOINTS.CLUB_MATCHES_OVERALL(id, pageSize), {
            signal: (controller as any).signal,
          })
        );

        const resArr = await Promise.all(promises);
        if (!mountedRef.current) return;

        const map: Record<number, ClubSeries> = {};
        resArr.forEach((res, idx) => {
          const id = idsToUse[idx];
          const items = res.data?.items ?? [];
          const points: OverallPoint[] = items
            .map((it) => ({
              matchId: it.matchId,
              date: it.date,
              ourStats: it.ourClub?.overallStats ?? null,
              oppStats: it.opponent?.overallStats ?? null,
              oppName: it.opponent?.clubName ?? "—",
              goalsFor: it.ourClub?.goals ?? 0,
              goalsAgainst: it.opponent?.goals ?? 0,
            }))
            // página 1 vem do mais novo → mais antigo; ordena ascendente por data
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const meta = selectedClubs.find((c) => c.clubId === id);
          map[id] = {
            clubId: id,
            clubName:
              meta?.clubName ??
              items.find((it) => it.ourClub?.clubName)?.ourClub?.clubName ??
              `Clube ${id}`,
            crestAssetId: meta?.crestAssetId ?? null,
            points,
          };
        });

        setSeriesByClub(map);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        setError(e?.message ?? "Erro ao carregar evolução");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [idsToUse.join(","), pageSize, reloadNonce]);

  // -------- Derived --------
  const clubsWithData = useMemo(
    () => idsToUse.map((id) => seriesByClub[id]).filter((x): x is ClubSeries => !!x),
    [idsToUse, seriesByClub]
  );

  const singleClub = clubsWithData.length === 1 ? clubsWithData[0] : null;

  const headerTitle =
    clubsWithData.length <= 1 ? singleClub?.clubName ?? club?.clubName ?? "" : "Vários clubes selecionados";

  // X labels: se multi, força índice; se single, respeita xMode
  const effectiveXMode: XMode = clubsWithData.length > 1 ? "index" : xMode;

  const maxLen = useMemo(
    () => clubsWithData.reduce((m, c) => Math.max(m, c.points.length), 0),
    [clubsWithData]
  );

  const xIndexLabels = useMemo(() => Array.from({ length: maxLen }, (_, i) => `Jogo ${i + 1}`), [maxLen]);
  const xDateLabels = useMemo(() => {
    if (!singleClub) return xIndexLabels;
    return singleClub.points.map((p) => formatDate(p.date));
  }, [singleClub, xIndexLabels]);
  const xLabels = effectiveXMode === "index" ? xIndexLabels : xDateLabels;

  const manyPoints = maxLen > 25;
  const pointRadius = manyPoints ? 0 : 2;

  // Agrupa as partidas (single club) por dia → faixas verticais com Δ SR líquido.
  const dayZones = useMemo<DayZone[]>(() => {
    if (!singleClub) return [];
    const pts = singleClub.points;
    const zones: DayZone[] = [];
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i === pts.length || dayKey(pts[i].date) !== dayKey(pts[start].date)) {
        const end = i - 1;
        const srEnd = toNum(pts[end].ourStats?.skillRating);
        // baseline = SR antes da 1ª partida do dia (ou a própria 1ª, p/ o dia inicial)
        const srBase = toNum(pts[start > 0 ? start - 1 : start].ourStats?.skillRating);
        zones.push({
          start,
          end,
          label: formatDayShort(pts[start].date),
          delta: srEnd - srBase,
          count: end - start + 1,
        });
        start = i;
      }
    }
    return zones;
  }, [singleClub]);

  const dayZonesEnabled = showDayZones && !!singleClub;

  // construir datasets por métrica
  const chartData = useMemo(() => {
    const fill = chartKind === "area";

    const datasets: any[] = clubsWithData.map((c) => {
      const raw = c.points.map((p) =>
        metric === "sr" ? toNum(p.ourStats?.skillRating) : toNum(p.ourStats?.currentDivision)
      );
      const vals = metric === "sr" && smooth ? movingAvg(raw, 5) : raw;
      const hex = colorFromId(c.clubId);
      // Variação de SR vs. jogo anterior (sempre a partir do SR real, não suavizado)
      const markers: SrMarker[] =
        metric === "sr"
          ? c.points.map((p, i) => {
              if (i === 0) return null;
              const delta = toNum(p.ourStats?.skillRating) - toNum(c.points[i - 1].ourStats?.skillRating);
              const text = delta > 0 ? `+${delta}` : `${delta}`;
              return { text, color: RESULT_COLOR[resultOf(p)] };
            })
          : [];
      return {
        label: c.clubName,
        data: pad(vals, maxLen),
        borderColor: hex,
        backgroundColor: withAlpha(hex, 0.15),
        borderWidth: 2,
        tension: metric === "division" ? 0 : 0.3,
        stepped: metric === "division" ? "before" : false,
        pointRadius,
        fill,
        ...(metric === "sr" ? { _markers: padMarkers(markers, maxLen) } : {}),
      };
    });

    // SR de adversário (apenas single club, métrica SR) para contexto
    if (metric === "sr" && singleClub) {
      const oppVals = singleClub.points.map((p) => toNum(p.oppStats?.skillRating));
      datasets.push({
        label: "SR adversário",
        data: pad(oppVals, maxLen),
        borderColor: "rgba(100,116,139,0.8)",
        backgroundColor: "rgba(148,163,184,0.10)",
        borderWidth: 1.5,
        borderDash: [5, 4],
        tension: 0.2,
        pointRadius: manyPoints ? 0 : 1.5,
        fill: false,
      });
    }
    return { labels: xLabels, datasets };
  }, [clubsWithData, singleClub, metric, chartKind, smooth, xLabels, maxLen, pointRadius, manyPoints]);

  const baseOptions: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        resultMarkers: { enabled: showResults },
        dayZones: { enabled: dayZonesEnabled, groups: dayZones },
        legend: { display: true, position: "top" },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              if (!items?.length) return "";
              const i = items[0].dataIndex ?? 0;
              if (effectiveXMode === "index") return `Jogo ${i + 1}`;
              const p = singleClub?.points?.[i];
              if (!p) return items?.[0]?.label ?? "";
              const vs = p.oppName ? ` vs ${p.oppName}` : "";
              return `${formatDate(p.date)}${vs} • ${p.goalsFor}-${p.goalsAgainst}`;
            },
            label: (ctx: any) => {
              const v = ctx.raw as number;
              return `${ctx.dataset.label}: ${Number.isFinite(v) ? v : "-"}`;
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
          beginAtZero: false,
          reverse: metric === "division", // divisão 1 = melhor → topo
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            precision: 0,
            callback: (val: any) => `${val}`,
          },
        },
      },
      elements: {
        point: { radius: pointRadius },
        line: { borderJoinStyle: "round", borderCapStyle: "round" },
      },
    }),
    [effectiveXMode, singleClub, metric, pointRadius, showResults, dayZonesEnabled, dayZones]
  );

  const quickSizes = [20, 50, 100];
  const forceReload = () => setReloadNonce((n) => n + 1);

  // =========================
  // Render
  // =========================

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Evolução do Overall — {headerTitle}</h1>
          {idsToUse.length > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              Clubes ativos: <span className="font-mono">{idsToUse.join(", ")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Últimas</span>
          <div className="flex items-center gap-1">
            {quickSizes.map((n) => (
              <button
                key={n}
                onClick={() => setPageSize(n)}
                className={`text-sm px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
                  pageSize === n ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
                }`}
                aria-pressed={pageSize === n}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24"
            min={5}
            value={pageSize}
            onChange={(e) => setPageSize(Math.max(5, parseInt(e.target.value) || 5))}
          />
          <span className="text-sm text-gray-700">partidas</span>
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
          Selecione um clube no menu para ver a evolução do overall.
        </div>
      )}

      {idsToUse.length > 0 && loading && (
        <div className="grid gap-3">
          <div className="animate-pulse bg-white border rounded-xl p-4 h-12" />
          <div className="animate-pulse bg-white border rounded-xl p-4 h-[360px]" />
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
          {/* CONTROLES DO GRÁFICO */}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3">
              <label className="text-sm text-gray-700">
                Métrica
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                >
                  <option value="sr">Skill Rating</option>
                  <option value="division">Divisão atual</option>
                </select>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-700">Visual</span>
                {(["line", "area"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setChartKind(k)}
                    className={`text-xs px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
                      chartKind === k ? "bg-gray-800 text-white border-gray-800" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {k === "line" ? "Linha" : "Área"}
                  </button>
                ))}
              </div>

              {metric === "sr" && (
                <label className="text-sm text-gray-700 flex items-center gap-1.5">
                  <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
                  Suavizar
                </label>
              )}

              {metric === "sr" && (
                <label className="text-sm text-gray-700 flex items-center gap-1.5">
                  <input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} />
                  Mostrar Δ SR
                </label>
              )}

              {!!singleClub && (
                <label
                  className="text-sm text-gray-700 flex items-center gap-1.5"
                  title="Agrupa as partidas por dia em faixas, com a variação líquida de SR no dia."
                >
                  <input type="checkbox" checked={showDayZones} onChange={(e) => setShowDayZones(e.target.checked)} />
                  Zonas por dia
                </label>
              )}

              <label className="text-sm text-gray-700">
                Eixo X
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={effectiveXMode}
                  onChange={(e) => setXMode(e.target.value as XMode)}
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
              <Line data={chartData as any} options={baseOptions} plugins={[dayZonesPlugin, resultMarkersPlugin]} />
            </div>
            {showResults && metric === "sr" && (
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>Δ SR vs. jogo anterior:</span>
                <span className="font-semibold text-green-600">vitória</span>
                <span className="font-semibold text-yellow-600">empate</span>
                <span className="font-semibold text-red-600">derrota</span>
              </div>
            )}
          </div>

          {/* SNAPSHOT ATUAL POR CLUBE */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Situação atual</div>
            <div
              className={`grid gap-3 ${
                clubsWithData.length === 1
                  ? "grid-cols-1"
                  : clubsWithData.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
              }`}
            >
              {clubsWithData.map((c) => (
                <OverallSummaryCard
                  key={c.clubId}
                  clubId={c.clubId}
                  clubName={c.clubName}
                  crestAssetId={c.crestAssetId}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
