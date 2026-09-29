import React from "react";
import { classifyStat } from "../../utils/statClassifier.ts";
import { StatWithQuality } from "../StatQualityIndicator.tsx";
import { Tooltip } from "../Tooltip.tsx";

export function StatTile({
  label,
  value,
  hint,
  statType,
  rawValue,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  statType?: string;
  rawValue?: number;
}) {
  const quality = statType && rawValue !== undefined ? classifyStat(statType, rawValue) : null;

  const tileContent = (
    <div className="rounded-2xl border bg-surface p-3 shadow-sm hover:shadow transition-shadow">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-fg">
        {quality ? <StatWithQuality value={value} quality={quality} statType={statType} rawValue={rawValue} /> : value}
      </div>
    </div>
  );

  return hint ? <Tooltip content={hint}>{tileContent}</Tooltip> : tileContent;
}
