import { Line } from "react-chartjs-2";

function trendArrow(data: (number | null)[]): { arrow: string; cls: string } {
  const vals = data.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 4) return { arrow: "→", cls: "text-fg-subtle" };
  const n = Math.max(1, Math.min(3, Math.floor(vals.length / 3)));
  const first = vals.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const last = vals.slice(-n).reduce((a, b) => a + b, 0) / n;
  const base = Math.abs(first) > 0.001 ? first : 1;
  const diff = (last - first) / base;
  if (diff > 0.05) return { arrow: "↑", cls: "text-positive" };
  if (diff < -0.05) return { arrow: "↓", cls: "text-negative" };
  return { arrow: "→", cls: "text-fg-subtle" };
}

function miniStats(data: (number | null)[], decimals = 1): { min: string; avg: string; max: string } | null {
  const vals = data.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const fmt = (n: number) => n.toFixed(decimals);
  return { min: fmt(min), avg: fmt(avg), max: fmt(max) };
}

export function ChartCard({
  label,
  color,
  datasets,
  options,
  labels,
  decimals = 1,
  showStats,
  themeKey,
}: {
  label: string;
  color: string;
  datasets: any[];
  options: any;
  labels: string[];
  decimals?: number;
  showStats: boolean;
  /** Muda quando o tema troca, para recriar o gráfico com as cores novas */
  themeKey?: string;
}) {
  const primaryData = (datasets[0]?.data ?? []) as (number | null)[];
  const trend = showStats ? trendArrow(primaryData) : null;
  const stats = showStats ? miniStats(primaryData, decimals) : null;

  return (
    <div className="bg-surface border rounded-xl p-4 hover:shadow-raised transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-8 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-fg-secondary">{label}</span>
        </div>
        {trend && (
          <span className={`text-base font-bold leading-none ${trend.cls}`}>{trend.arrow}</span>
        )}
      </div>
      <div className="h-56">
        <Line key={themeKey} data={{ labels, datasets }} options={options} />
      </div>
      {stats && (
        <div className="mt-2 flex gap-3 text-[11px] text-fg-subtle border-t pt-1.5">
          <span>Mín: <span className="font-medium text-fg-muted">{stats.min}</span></span>
          <span>Méd: <span className="font-medium text-fg-muted">{stats.avg}</span></span>
          <span>Máx: <span className="font-medium text-fg-muted">{stats.max}</span></span>
        </div>
      )}
    </div>
  );
}
