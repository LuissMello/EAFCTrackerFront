import React from "react";
import { fmtBRFromISO } from "../utils/date.ts";
import type { DateColor } from "../utils/dateColors.ts";

/** Selo colorido (uma cor por dia) com a data em dd/mm/aaaa. */
export const DateBadge: React.FC<{ dateISO: string; colorMap: Map<string, DateColor>; className?: string }> = ({
  dateISO,
  colorMap,
  className,
}) => {
  const key = dateISO.slice(0, 10);
  const c = colorMap.get(key) ?? { bg: "#E5E7EB", border: "#9CA3AF", fg: "#111827" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className ?? ""}`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
      title={fmtBRFromISO(dateISO)}
      aria-label={fmtBRFromISO(dateISO)}
    >
      {fmtBRFromISO(dateISO)}
    </span>
  );
};
