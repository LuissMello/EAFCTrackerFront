import React from "react";
import { fmtNum, fmtPct } from "../../utils/number.ts";

export function StatCompare({
  label,
  me,
  team,
  pct = false,
  fixed2 = false,
}: {
  label: string;
  me: number;
  team: number;
  pct?: boolean;
  fixed2?: boolean;
}) {
  const m = Number(me || 0);
  const t = Number(team || 0);
  const isBetter = m >= t;
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isBetter ? "bg-positive-soft text-positive-fg" : "bg-surface-sunken text-fg-secondary"
          }`}
        >
          {isBetter ? "↑" : "→"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[11px] text-fg-muted">Você</div>
          <div className="font-semibold">{pct ? fmtPct(m) : fixed2 ? m.toFixed(2) : fmtNum(m)}</div>
        </div>
        <div>
          <div className="text-[11px] text-fg-muted">Time (média)</div>
          <div className="font-semibold">{pct ? fmtPct(t) : fixed2 ? t.toFixed(2) : fmtNum(t)}</div>
        </div>
      </div>
    </div>
  );
}
