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
