// src/utils/dateColors.ts

export type DateColor = { bg: string; border: string; fg: string };

/**
 * Cores por data (NUNCA repete entre datas diferentes): uma matiz distinta por dia (YYYY-MM-DD),
 * espaçadas pelo ângulo áureo, na ordem em que as datas aparecem.
 */
export function buildDateColorMap(datesISODesc: string[]): Map<string, DateColor> {
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const d of datesISODesc) {
    const key = d.slice(0, 10);
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(key);
    }
  }

  const map = new Map<string, DateColor>();
  const GOLDEN_ANGLE = 137.508;
  for (let i = 0; i < uniq.length; i++) {
    const h = (i * GOLDEN_ANGLE) % 360;
    const bg = `hsl(${h} 80% 88%)`;
    const border = `hsl(${h} 75% 45%)`;
    const fg = "#111827";
    map.set(uniq[i], { bg, border, fg });
  }
  return map;
}
