// src/utils/chart.ts — helpers compartilhados pelas telas com gráficos (Chart.js).

/** cor hex → rgba com alpha */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** hash → cor estável (#RRGGBB) para um id numérico */
export function colorFromId(num: number): string {
  let x = Math.imul(num ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  const r = (x & 0xff).toString(16).padStart(2, "0");
  const g = ((x >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b = ((x >>> 16) & 0xff).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

/** média móvel simples (janela `win`; nos primeiros pontos repete o valor original) */
export function movingAvg(arr: number[], win = 5): number[] {
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
