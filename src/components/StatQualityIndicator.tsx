import React from "react";
import { QualityInfo, getStatQualityDetails } from "../utils/statClassifier.ts";
import { Tooltip } from "./Tooltip.tsx";

interface StatQualityIndicatorProps {
  quality: QualityInfo | null;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  statType?: string;
  value?: number;
}

export function StatQualityIndicator({
  quality,
  size = "small",
  showLabel = false,
  statType,
  value,
}: StatQualityIndicatorProps) {
  if (!quality) return null;

  const sizeClasses = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4",
  };

  const dotColors = {
    poor: "bg-red-500",
    decent: "bg-orange-500",
    good: "bg-green-500",
    veryGood: "bg-blue-500",
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Tooltip
        content={
          statType && value !== undefined ? getStatQualityDetails(statType, value) || quality.label : quality.label
        }
      >
        <div className={`rounded-full ${sizeClasses[size]} ${dotColors[quality.level]}`} />
      </Tooltip>
      {showLabel && <span className={`text-xs ${quality.color}`}>{quality.label}</span>}
    </div>
  );
}

// ? Variant for inline use with stat values
interface StatWithQualityProps {
  value: string | React.ReactNode;
  quality: QualityInfo | null;
  className?: string;
  statType?: string;
  rawValue?: number;
}

export function StatWithQuality({ value, quality, className = "", statType, rawValue }: StatWithQualityProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{value}</span>
      <StatQualityIndicator quality={quality} size="small" statType={statType} value={rawValue} />
    </div>
  );
}
