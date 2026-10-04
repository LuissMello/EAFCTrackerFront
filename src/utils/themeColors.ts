/**
 * Read a semantic CSS color token (defined in index.css) as a legacy
 * `rgba(r, g, b, a)` string. Legacy form is used so it works for both CSS
 * and <canvas> fillStyle/strokeStyle (Chart.js).
 *
 * Charts render to <canvas> and do NOT restyle when CSS variables change, so
 * read these at config time and re-key the chart on the resolved theme (see
 * useTheme().resolvedTheme) to force a rebuild on light/dark switch.
 */
export function cssVar(name: string, alpha = 1): string {
    if (typeof window === "undefined") {
        return `rgba(100, 116, 139, ${alpha})`;
    }
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    if (!channels) return `rgba(100, 116, 139, ${alpha})`;
    const [r, g, b] = channels.split(/\s+/);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Token CSS como #RRGGBB (para usar com withAlpha). */
export function cssVarHex(name: string, fallback = "#64748B"): string {
    if (typeof window === "undefined") return fallback;
    const channels = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const parts = channels.split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
    return "#" + parts.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("");
}

const SERIES_VARS = ["--color-accent", "--chart-series-2", "--chart-series-3", "--chart-series-4", "--chart-series-5"];

/** Cor da n-ésima série de um gráfico (1ª = accent do tema; depois tokens --chart-series-N). */
export function seriesColor(index: number): string {
    return cssVarHex(SERIES_VARS[Math.max(0, index) % SERIES_VARS.length]);
}

/** Common chart-chrome colors derived from the active theme. */
export function chartTheme() {
    return {
        axis: cssVar("--chart-axis"),
        grid: cssVar("--chart-grid", 0.08),
        gridStrong: cssVar("--chart-grid", 0.16),
        fg: cssVar("--color-fg"),
        fgMuted: cssVar("--color-fg-muted"),
        surface: cssVar("--color-surface"),
        border: cssVar("--color-border"),
        accent: cssVar("--color-accent"),
        positive: cssVar("--color-positive"),
        warning: cssVar("--color-warning"),
        negative: cssVar("--color-negative"),
    };
}
