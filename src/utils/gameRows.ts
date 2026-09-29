// src/utils/gameRows.ts
import type { PlayerStats } from "../types/stats.ts";
import type { GameRow } from "../types/statsByDate.ts";
import { fmtHM } from "./date.ts";
import { toNum } from "./number.ts";

export function buildGameRows(baseItems: PlayerStats[]): GameRow[] {
  return baseItems.map((p, idx) => {
    const anyP: any = p;

    const goals = toNum(anyP.totalGoals ?? anyP.TotalGoals);
    const assists = toNum(anyP.totalAssists ?? anyP.TotalAssists);
    const preAssists = toNum(anyP.totalPreAssists ?? anyP.TotalPreAssists);
    const passesMade = toNum(anyP.totalPassesMade ?? anyP.TotalPassesMade);
    const passesAttempted = toNum(anyP.totalPassAttempts ?? anyP.TotalPassAttempts);
    const tacklesMade = toNum(anyP.totalTacklesMade ?? anyP.TotalTacklesMade);
    const tacklesAttempted = toNum(anyP.totalTackleAttempts ?? anyP.TotalTackleAttempts);
    const rating = toNum(anyP.avgRating ?? anyP.AvgRating ?? anyP.rating ?? anyP.Rating);
    const passPct = passesAttempted > 0 ? (passesMade * 100) / passesAttempted : 0;
    const tacklePct = tacklesAttempted > 0 ? (tacklesMade * 100) / tacklesAttempted : 0;

    const rawDate = anyP.date ?? anyP.Date;
    let dateISO: string | null = null;
    let time: string | null = null;

    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) {
        dateISO = d.toISOString();
        time = fmtHM(d);
      }
    }

    const id = `${idx}-${dateISO ?? "nodate"}-${goals}-${assists}`;

    return {
      id,
      dateISO,
      time,
      goals,
      assists,
      preAssists,
      passesMade,
      passesAttempted,
      passPct,
      tacklesMade,
      tacklesAttempted,
      tacklePct,
      rating,
    };
  });
}
