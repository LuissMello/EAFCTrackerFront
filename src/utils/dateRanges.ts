import { toYmd } from "./date.ts";

/** Presets de período compartilhados por todas as telas com filtro de datas. */
export type DatePresetId = "7d" | "14d" | "30d" | "month" | "90d" | "365d";

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
    { id: "7d", label: "7 dias" },
    { id: "14d", label: "14 dias" },
    { id: "30d", label: "30 dias" },
    { id: "month", label: "Mês atual" },
    { id: "90d", label: "90 dias" },
    { id: "365d", label: "Últimos 365 dias" },
];

export type DateRange = { from: string; to: string };

const DAYS: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, "365d": 365 };

/** Intervalo (datas locais yyyy-MM-dd, inclusivo) de um preset. "N dias" termina HOJE e inclui hoje. */
export function rangeForPreset(id: DatePresetId, now: Date = new Date()): DateRange {
    if (id === "month") {
        return {
            from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
            to: toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }
    const n = DAYS[id];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (n - 1));
    return { from: toYmd(start), to: toYmd(now) };
}

/** Padrão das telas: últimos 30 dias terminando hoje. */
export function defaultRange(now: Date = new Date()): DateRange {
    return rangeForPreset("30d", now);
}

/** Qual preset corresponde exatamente ao intervalo atual (ou null para "personalizado"). */
export function matchPreset(range: DateRange, now: Date = new Date()): DatePresetId | null {
    for (const p of DATE_PRESETS) {
        const r = rangeForPreset(p.id, now);
        if (r.from === range.from && r.to === range.to) return p.id;
    }
    return null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const isYmd = (s: string | null | undefined): s is string =>
    !!s && YMD.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
