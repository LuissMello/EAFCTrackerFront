// src/utils/goalAnalysis.ts
// Helpers compartilhados entre GoalAnalytics e MatchGoalAnalysis.

export const PALETTE = [
  { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300",    dot: "bg-blue-500",    bar: "bg-blue-500"    },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-300",  dot: "bg-violet-500",  bar: "bg-violet-500"  },
  { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",   dot: "bg-amber-500",   bar: "bg-amber-500"   },
  { bg: "bg-rose-100",    text: "text-rose-800",    border: "border-rose-300",    dot: "bg-rose-500",    bar: "bg-rose-500"    },
  { bg: "bg-cyan-100",    text: "text-cyan-800",    border: "border-cyan-300",    dot: "bg-cyan-500",    bar: "bg-cyan-500"    },
  { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300",  dot: "bg-orange-500",  bar: "bg-orange-500"  },
  { bg: "bg-pink-100",    text: "text-pink-800",    border: "border-pink-300",    dot: "bg-pink-500",    bar: "bg-pink-500"    },
  { bg: "bg-teal-100",    text: "text-teal-800",    border: "border-teal-300",    dot: "bg-teal-500",    bar: "bg-teal-500"    },
  { bg: "bg-indigo-100",  text: "text-indigo-800",  border: "border-indigo-300",  dot: "bg-indigo-500",  bar: "bg-indigo-500"  },
];

export function getPalette(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

export interface PassFlowEntry { from: string; to: string; fromId?: number | null; toId?: number | null; count: number }

/** Qualquer gol/vínculo com scorer + assistência + pré-assistência (por nome). */
export interface GoalLinkNames {
  scorerId?: number | null;
  assistId?: number | null;
  preAssistId?: number | null;
  scorerName: string;
  assistName: string | null;
  preAssistName: string | null;
}

/** Fluxo de passes (assistente → artilheiro e pré-assistente → assistente), ordenado por contagem. */
export function buildPassFlow(goals: GoalLinkNames[]): PassFlowEntry[] {
  const map = new Map<string, PassFlowEntry>();
  for (const g of goals) {
    if (g.assistName) {
      const key = `${g.assistId ?? g.assistName}→${g.scorerId ?? g.scorerName}`;
      if (!map.has(key)) map.set(key, { fromId: g.assistId, toId: g.scorerId, from: g.assistName, to: g.scorerName, count: 0 });
      map.get(key)!.count++;
    }
    if (g.preAssistName && g.assistName) {
      const key = `${g.preAssistId ?? g.preAssistName}→${g.assistId ?? g.assistName}`;
      if (!map.has(key)) map.set(key, { fromId: g.preAssistId, toId: g.assistId, from: g.preAssistName, to: g.assistName, count: 0 });
      map.get(key)!.count++;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
