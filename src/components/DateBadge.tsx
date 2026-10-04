import React from "react";
import { fmtBRFromISO } from "../utils/date.ts";
import { NEUTRAL_DATE_COLOR, type DateColor } from "../utils/dateColors.ts";

/** Selo colorido (uma cor por dia) com a data em dd/mm/aaaa. */
export const DateBadge: React.FC<{ dateISO: string; colorMap: Map<string, DateColor>; className?: string; short?: boolean }> = ({
  dateISO,
  colorMap,
  className,
  short = false,
}) => {
  const key = dateISO.slice(0, 10);
  const c = colorMap.get(key) ?? NEUTRAL_DATE_COLOR;
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${short ? "px-1.5 py-0 text-[11px] leading-5" : "px-2 py-0.5 text-xs"} ${className ?? ""}`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
      title={fmtBRFromISO(dateISO)}
      aria-label={fmtBRFromISO(dateISO)}
    >
      {short ? fmtBRFromISO(dateISO).slice(0, 5) : fmtBRFromISO(dateISO)}
    </span>
  );
};
