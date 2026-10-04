import React, { useMemo, useState } from "react";
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
import { PageHeader, PageShell } from "../components/ui.tsx";
import { useClubIds } from "../hooks/useClubIds.ts";
import { useAbortableFetch } from "../hooks/useAbortableFetch.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { parseTimestamp, fmtDateBRShort } from "../utils/date.ts";
import { withAlpha } from "../utils/chart.ts";
import OverallSummaryCard, { ClubOverallRow } from "../components/OverallSummaryCard.tsx";
import { useTheme } from "../hooks/useTheme.tsx";
import { chartTheme, cssVar, seriesColor } from "../utils/themeColors.ts";

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
  sessionId: number | null;
  sessionDate: string | null;
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


const pad = (arr: (number | null)[], len: number) => [
  ...arr,
  ...Array(Math.max(0, len - arr.length)).fill(null),
];

const knownNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Uma média não deve atravessar um trecho sem captura de SR.
const movingAvgWithGaps = (values: (number | null)[], windowSize: number): (number | null)[] =>
  values.map((_, index) => {
    const window = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return window.some((value) => value === null)
      ? null
      : window.reduce<number>((total, value) => total + (value ?? 0), 0) / window.length;
  });

type MatchResult = "W" | "D" | "L";
const resultOf = (p: OverallPoint): MatchResult =>
  p.goalsFor > p.goalsAgainst ? "W" : p.goalsFor < p.goalsAgainst ? "L" : "D";

// verde = vitória, amarelo = empate, vermelho = derrota (lidos do tema ativo)
const resultColors = (): Record<MatchResult, string> => {
  const t = chartTheme();
  return { W: t.positive, D: t.warning, L: t.negative };
};

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
      // Pontos muito próximos (celular): desenha só 1 a cada N rótulos para não sobrepor
      const step = chart.chartArea.width / Math.max(1, meta.data.length);
      const every = Math.max(1, Math.ceil(30 / Math.max(step, 1)));
      meta.data.forEach((pt: any, i: number) => {
        const m = markers[i];
        if (!m || i % every !== 0) return;
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

const DAY_SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const formatSessionDay = (date: string | null, fallback: string) =>
  date ? DAY_SHORT.format(new Date(`${date}T12:00:00`)) : fmtDateBRShort(fallback);

interface DayZone {
  start: number; // índice (na série) da primeira partida do dia
  end: number; // índice da última partida do dia
  label: string; // ex.: "30/05"
  delta: number | null; // null quando falta captura anterior ou final
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
    const t = chartTheme();
    const zonePos = cssVar("--color-positive", 0.08);
    const zoneNeg = cssVar("--color-negative", 0.08);
    const zoneNeutral = cssVar("--color-fg-muted", 0.08);
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
      ctx.fillStyle = g.delta !== null && g.delta > 0 ? zonePos : g.delta !== null && g.delta < 0 ? zoneNeg : zoneNeutral;
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
      if (gi < groups.length - 1) {
        ctx.strokeStyle = t.grid;
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
    const t = chartTheme();
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
      if (right - left < 34) return; // estreito demais p/ rótulo
      ctx.font = "600 11px sans-serif";
      ctx.fillStyle = t.fgMuted;
      ctx.textBaseline = "top";
      ctx.fillText(g.label, cx, chartArea.top + 3);
      const deltaText = g.delta === null ? "—" : g.delta > 0 ? `+${g.delta}` : `${g.delta}`;
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = g.delta !== null && g.delta > 0 ? t.positive : g.delta !== null && g.delta < 0 ? t.negative : t.fgMuted;
      // faixa estreita (celular): só o número, sem o sufixo "SR" (explicado na legenda)
      ctx.fillText(g.delta === null || right - left < 62 ? deltaText : `${deltaText} SR`, cx, chartArea.top + 15);
    });
    ctx.restore();
  },
};

// =========================
// MatchHistoryTable
// =========================

const RESULT_BADGE: Record<MatchResult, string> = {
  W: "bg-positive-soft text-positive-fg",
  D: "bg-warning-soft text-warning-fg",
  L: "bg-negative-soft text-negative-fg",
};
const RESULT_LABEL: Record<MatchResult, string> = { W: "V", D: "E", L: "D" };

function MatchHistoryTable({ series, showClubName }: { series: ClubSeries; showClubName?: boolean }) {
  const rows = [...series.points].reverse(); // mais recente primeiro

  return (
    <div className="bg-surface border rounded-xl overflow-hidden">
      {showClubName && (
        <div className="px-4 py-3 border-b font-semibold text-fg-secondary">{series.clubName}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-raised text-xs text-fg-muted uppercase tracking-wide">
              <th scope="col" className="px-3 py-2 text-left">Data</th>
              <th scope="col" className="px-3 py-2 text-left">Adversário</th>
              <th scope="col" className="px-3 py-2 text-center">Placar</th>
              <th scope="col" className="px-3 py-2 text-center">Res.</th>
              <th scope="col" className="px-3 py-2 text-right"><abbr title="Skill Rating" className="no-underline">SR</abbr></th>
              <th scope="col" className="px-3 py-2 text-right"><abbr title="Skill Rating do adversário" className="no-underline">SR Adv.</abbr></th>
              <th scope="col" className="px-3 py-2 text-right"><abbr title="Variação de Skill Rating" className="no-underline">Δ SR</abbr></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p, i) => {
              const ourSR = knownNumber(p.ourStats?.skillRating);
              const oppSR = knownNumber(p.oppStats?.skillRating);
              const prevP = rows[i + 1]; // partida anterior (mais antiga)
              const previousSR = knownNumber(prevP?.ourStats?.skillRating);
              const delta = ourSR !== null && previousSR !== null ? ourSR - previousSR : null;
              const res = resultOf(p);
              const scoreColor =
                res === "W" ? "text-positive" : res === "L" ? "text-negative" : "text-warning";

              return (
                <tr key={p.matchId} className="hover:bg-surface-raised transition-colors">
                  <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{fmtDateBRShort(p.date)}</td>
                  <td className="px-3 py-2 text-fg font-medium max-w-[140px] truncate">
                    {p.oppName || "—"}
                  </td>
                  <td className={`px-3 py-2 text-center font-bold ${scoreColor}`}>
                    {p.goalsFor}–{p.goalsAgainst}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${RESULT_BADGE[res]}`}>
                      {RESULT_LABEL[res]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-fg">
                    {ourSR ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-fg-subtle">
                    {oppSR ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {delta === null ? (
                      <span className="text-fg-subtle">—</span>
                    ) : (
                      <span
                        className={
                          delta > 0 ? "text-positive" : delta < 0 ? "text-negative" : "text-fg-subtle"
                        }
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================
// Component
// =========================

type Metric = "sr" | "division";
type ChartKind = "line" | "area";

export default function OverallEvolution() {
  const { selectedClubs } = useClub();
  const { resolvedTheme } = useTheme();

  // ids efetivos (multi). Se nenhum selecionado, tenta o single legacy.
  const idsToUse = useClubIds();

  const [pageSize, setPageSize] = useState(20);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [seriesByClub, setSeriesByClub] = useState<Record<number, ClubSeries>>({});

  const [metric, setMetric] = useState<Metric>("sr");
  const [chartKind, setChartKind] = useState<ChartKind>("line");
  const [smooth, setSmooth] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [showDayZones, setShowDayZones] = useState(true);
  type XMode = "index" | "date";
  const [xMode, setXMode] = useState<XMode>("date");

  // -------- Fetch (multi) --------
  const { loading, error } = useAbortableFetch(
    async (signal) => {
      const promises = idsToUse.map((id) =>
        api.get<PagedResult<MatchWithOverallStatsDto>>(API_ENDPOINTS.CLUB_MATCHES_OVERALL(id, pageSize), {
          signal,
        })
      );

      const resArr = await Promise.all(promises);
      const memberships = await Promise.all(resArr.map(async (res, idx) => {
        const matchIds = (res.data?.items ?? []).map(item => item.matchId);
        if (!matchIds.length) return new Map<number, { sessionId: number; date: string }>();
        const { data } = await api.get<{ matchId: number; sessionId: number; date: string }[]>(
          API_ENDPOINTS.CALENDAR_SESSION_MEMBERSHIPS,
          { params: { clubId: idsToUse[idx], matchIds: matchIds.join(",") }, signal }
        );
        return new Map(data.map(item => [item.matchId, item]));
      }));
      if (signal.aborted) return;

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
            sessionId: memberships[idx].get(it.matchId)?.sessionId ?? null,
            sessionDate: memberships[idx].get(it.matchId)?.date ?? null,
          }))
          // página 1 vem do mais novo → mais antigo; ordena ascendente por data
          .sort((a, b) => (parseTimestamp(a.date)?.getTime() ?? 0) - (parseTimestamp(b.date)?.getTime() ?? 0));

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
    },
    [idsToUse.join(","), pageSize, reloadNonce],
    { enabled: idsToUse.length > 0, errorMessage: "Erro ao carregar evolução" }
  );

  // -------- Derived --------
  // Nome/escudo vêm da seleção atual quando disponíveis (podem chegar depois da busca das séries)
  const clubsWithData = useMemo(
    () =>
      idsToUse
        .map((id) => {
          const s = seriesByClub[id];
          if (!s) return undefined;
          const meta = selectedClubs.find((c) => c.clubId === id);
          if (!meta) return s;
          const clubName = meta.clubName ?? s.clubName;
          const crestAssetId = s.crestAssetId ?? meta.crestAssetId ?? null;
          return clubName === s.clubName && crestAssetId === s.crestAssetId ? s : { ...s, clubName, crestAssetId };
        })
        .filter((x): x is ClubSeries => !!x),
    [idsToUse, seriesByClub, selectedClubs]
  );

  const singleClub = clubsWithData.length === 1 ? clubsWithData[0] : null;


  // X labels: se multi, força índice; se single, respeita xMode
  const effectiveXMode: XMode = clubsWithData.length > 1 ? "index" : xMode;

  const maxLen = useMemo(
    () => clubsWithData.reduce((m, c) => Math.max(m, c.points.length), 0),
    [clubsWithData]
  );

  const xIndexLabels = useMemo(() => Array.from({ length: maxLen }, (_, i) => `Jogo ${i + 1}`), [maxLen]);
  const xDateLabels = useMemo(() => {
    if (!singleClub) return xIndexLabels;
    return singleClub.points.map((p) => fmtDateBRShort(p.date));
  }, [singleClub, xIndexLabels]);
  const xLabels = effectiveXMode === "index" ? xIndexLabels : xDateLabels;

  const manyPoints = maxLen > 25;
  const pointRadius = manyPoints ? 0 : 2;

  // Agrupa pela sessão atribuída pela API; a faixa continua válida ao cruzar a meia-noite.
  const dayZones = useMemo<DayZone[]>(() => {
    if (!singleClub) return [];
    const pts = singleClub.points;
    const zones: DayZone[] = [];
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i === pts.length ||
          (pts[i].sessionId === null ? `match:${pts[i].matchId}` : `session:${pts[i].sessionId}`) !==
          (pts[start].sessionId === null ? `match:${pts[start].matchId}` : `session:${pts[start].sessionId}`)) {
        const end = i - 1;
        const srEnd = knownNumber(pts[end].ourStats?.skillRating);
        const srBase = start > 0 ? knownNumber(pts[start - 1].ourStats?.skillRating) : null;
        zones.push({
          start,
          end,
          label: formatSessionDay(pts[start].sessionDate, pts[start].date),
          delta: srEnd !== null && srBase !== null ? srEnd - srBase : null,
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
    const RESULT_COLOR = resultColors();

    const datasets: any[] = clubsWithData.map((c) => {
      const raw = c.points.map((p) =>
        metric === "sr" ? knownNumber(p.ourStats?.skillRating) : knownNumber(p.ourStats?.currentDivision)
      );
      const vals = metric === "sr" && smooth ? movingAvgWithGaps(raw, 5) : raw;
      const hex = seriesColor(Math.max(0, clubsWithData.findIndex((x) => x.clubId === c.clubId)));
      // Variação de SR vs. jogo anterior (sempre a partir do SR real, não suavizado)
      const markers: SrMarker[] =
        metric === "sr"
          ? c.points.map((p, i) => {
              if (i === 0) return null;
              const currentSR = knownNumber(p.ourStats?.skillRating);
              const previousSR = knownNumber(c.points[i - 1].ourStats?.skillRating);
              if (currentSR === null || previousSR === null) return null;
              const delta = currentSR - previousSR;
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
      const oppVals = singleClub.points.map((p) => knownNumber(p.oppStats?.skillRating));
      datasets.push({
        label: "SR adversário",
        data: pad(oppVals, maxLen),
        borderColor: cssVar("--color-fg-muted", 0.8),
        backgroundColor: cssVar("--color-fg-muted", 0.1),
        borderWidth: 1.5,
        borderDash: [5, 4],
        tension: 0.2,
        pointRadius: manyPoints ? 0 : 1.5,
        fill: false,
      });
    }
    return { labels: xLabels, datasets };
  }, [clubsWithData, singleClub, metric, chartKind, smooth, xLabels, maxLen, pointRadius, manyPoints, resolvedTheme]);

  const baseOptions: any = useMemo(
    () => {
    const t = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        resultMarkers: { enabled: showResults },
        dayZones: { enabled: dayZonesEnabled, groups: dayZones },
        legend: { display: true, position: "top", labels: { color: t.fg } },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          callbacks: {
            title: (items: any[]) => {
              if (!items?.length) return "";
              const i = items[0].dataIndex ?? 0;
              if (effectiveXMode === "index") return `Jogo ${i + 1}`;
              const p = singleClub?.points?.[i];
              if (!p) return items?.[0]?.label ?? "";
              const vs = p.oppName ? ` vs ${p.oppName}` : "";
              return `${fmtDateBRShort(p.date)}${vs} • ${p.goalsFor}-${p.goalsAgainst}`;
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
          grid: { display: false, color: t.grid },
          ticks: { autoSkip: true, maxTicksLimit: 8, color: t.fgMuted },
        },
        y: {
          beginAtZero: false,
          reverse: metric === "division", // divisão 1 = melhor → topo
          grid: { color: t.grid },
          ticks: {
            precision: 0,
            callback: (val: any) => `${val}`,
            color: t.fgMuted,
          },
        },
      },
      elements: {
        point: { radius: pointRadius },
        line: { borderJoinStyle: "round", borderCapStyle: "round" },
      },
    };
    },
    [effectiveXMode, singleClub, metric, pointRadius, showResults, dayZonesEnabled, dayZones, resolvedTheme]
  );

  const quickSizes = [20, 50, 100];
  const forceReload = () => setReloadNonce((n) => n + 1);

  const clubNamesLabel =
    idsToUse.length > 0 ? (
      <>
        Clubes ativos:{" "}
        <span className="font-medium">
          {idsToUse.map((id) => selectedClubs.find((c) => c.clubId === id)?.clubName ?? seriesByClub[id]?.clubName ?? `Clube ${id}`).join(", ")}
        </span>
      </>
    ) : undefined;

  // =========================
  // Render
  // =========================

  return (
    <PageShell size="2xl" className="space-y-6">
      <PageHeader
        eyebrow="Clube"
        title="Evolução do overall"
        subtitle={clubNamesLabel}
        className="mb-0"
        actions={
          <>
          <span className="text-sm text-fg-secondary">Últimas</span>
          <div className="flex items-center gap-1">
            {quickSizes.map((n) => (
              <button
                key={n}
                onClick={() => setPageSize(n)}
                className={`text-sm px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
                  pageSize === n ? "bg-accent text-accent-fg border-accent" : "bg-surface text-fg-secondary hover:bg-surface-raised"
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
          <span className="text-sm text-fg-secondary">partidas</span>
          <button
            onClick={forceReload}
            className="ml-2 text-sm px-3 py-1 rounded border bg-surface hover:bg-surface-raised"
            title="Recarregar"
          >
            Recarregar
          </button>
          </>
        }
      />

      {idsToUse.length === 0 && (
        <div className="p-3 bg-warning-soft border border-warning/40 text-warning-fg rounded">
          Selecione um clube no menu para ver a evolução do overall.
        </div>
      )}

      {idsToUse.length > 0 && loading && (
        <div className="grid gap-3">
          <div className="animate-pulse bg-surface border rounded-xl p-4 h-12" />
          <div className="animate-pulse bg-surface border rounded-xl p-4 h-[360px]" />
          <div className="animate-pulse bg-surface border rounded-xl p-4 h-48" />
        </div>
      )}

      {idsToUse.length > 0 && error && (
        <div className="p-3 bg-negative-soft border border-negative/40 text-negative-fg rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={forceReload} className="text-sm px-3 py-1 rounded border bg-surface hover:bg-surface-raised">
            Tentar novamente
          </button>
        </div>
      )}

      {idsToUse.length > 0 && !loading && !error && clubsWithData.length > 0 && (
        <>
          {/* CONTROLES DO GRÁFICO */}
          <div className="bg-surface border rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
              <label className="text-sm text-fg-secondary">
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
                <span className="text-sm text-fg-secondary">Visual</span>
                {(["line", "area"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setChartKind(k)}
                    className={`text-xs px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
                      chartKind === k ? "bg-accent text-accent-fg border-accent" : "bg-surface text-fg-secondary hover:bg-surface-raised"
                    }`}
                  >
                    {k === "line" ? "Linha" : "Área"}
                  </button>
                ))}
              </div>

              {metric === "sr" && (
                <label className="text-sm text-fg-secondary flex items-center gap-1.5">
                  <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
                  Suavizar
                </label>
              )}

              {metric === "sr" && (
                <label className="text-sm text-fg-secondary flex items-center gap-1.5">
                  <input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} />
                  Mostrar Δ SR
                </label>
              )}

              {!!singleClub && (
                <label
                  className="text-sm text-fg-secondary flex items-center gap-1.5"
                  title="Agrupa as partidas por sessão de jogo, com a variação líquida de SR em cada sessão."
                >
                  <input type="checkbox" checked={showDayZones} onChange={(e) => setShowDayZones(e.target.checked)} />
                  Sessões de jogo
                </label>
              )}

              <label className="text-sm text-fg-secondary">
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
            {metric === "sr" && (
              <p className="mt-3 text-xs text-fg-muted">
                <strong>SR = Skill Rating</strong>, a pontuação de habilidade do clube no Pro Clubs. Em telas pequenas alguns rótulos de Δ SR ficam ocultos para não se sobrepor; toque no ponto para ver o valor.
              </p>
            )}
            <div className="mt-4 h-[360px]">
              <Line key={resolvedTheme} data={chartData as any} options={baseOptions} plugins={[dayZonesPlugin, resultMarkersPlugin]} />
            </div>
            {showResults && metric === "sr" && (
              <div className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
                <span><abbr title="Skill Rating" className="no-underline font-semibold">SR</abbr> = Skill Rating · Δ SR vs. jogo anterior:</span>
                <span className="font-semibold text-positive">vitória</span>
                <span className="font-semibold text-warning">empate</span>
                <span className="font-semibold text-negative">derrota</span>
              </div>
            )}
          </div>

          {/* SNAPSHOT ATUAL POR CLUBE */}
          <div>
            <div className="text-xs text-fg-muted mb-2">Situação atual</div>
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

          {/* HISTÓRICO DE PARTIDAS */}
          <div>
            <div className="text-xs text-fg-muted mb-2">Histórico de partidas</div>
            <div className="space-y-4">
              {clubsWithData.map((c) => (
                <MatchHistoryTable
                  key={c.clubId}
                  series={c}
                  showClubName={clubsWithData.length > 1}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
