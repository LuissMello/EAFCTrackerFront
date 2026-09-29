import React from "react";

export function Badge({
  color = "gray",
  children,
}: {
  color?: "gray" | "green" | "red" | "amber";
  children: React.ReactNode;
}) {
  const palette: Record<string, string> = {
    gray: "bg-surface-raised border-border text-fg-muted",
    green: "bg-positive-soft border-positive/40 text-positive-fg",
    red: "bg-negative-soft border-negative/40 text-negative-fg",
    amber: "bg-warning-soft border-warning/40 text-warning-fg",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${palette[color]}`}>
      {children}
    </span>
  );
}

export function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses || 1;
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div style={{ width: `${(wins / total) * 100}%` }} className="bg-positive" />
        <div style={{ width: `${(draws / total) * 100}%` }} className="bg-warning" />
        <div style={{ width: `${(losses / total) * 100}%` }} className="bg-negative" />
      </div>
      <div className="flex gap-3 text-[11px] tabular-nums">
        <span className="text-positive font-semibold">V {wins}</span>
        <span className="text-warning font-semibold">E {draws}</span>
        <span className="text-negative font-semibold">D {losses}</span>
      </div>
    </div>
  );
}
