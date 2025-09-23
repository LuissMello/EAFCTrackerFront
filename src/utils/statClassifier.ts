export type QualityLevel = "poor" | "decent" | "good" | "veryGood";

export interface QualityInfo {
  level: QualityLevel;
  color: string;
  bgColor: string;
  label: string;
}

export interface StatThresholds {
  poor: number;
  decent: number;
  good: number;
  veryGood: number;
}

// ? Define stat thresholds
const STAT_THRESHOLDS: Record<string, StatThresholds> = {
  shotToGoalConversion: {
    poor: 10,
    decent: 15,
    good: 25,
    veryGood: 35,
  },
  shotsOnTarget: {
    poor: 40,
    decent: 60,
    good: 75,
    veryGood: 90,
  },
  passCompletion: {
    poor: 75,
    decent: 85,
    good: 90,
    veryGood: 90,
  },
  goalsPerMatch: {
    poor: 2.0,
    decent: 3.0,
    good: 4.0,
    veryGood: 4.0,
  },
  tackleDuelWin: {
    poor: 50,
    decent: 60,
    good: 70,
    veryGood: 70,
  },
  teamPossession: {
    poor: 45,
    decent: 55,
    good: 65,
    veryGood: 65,
  },
  winRate: {
    poor: 30,
    decent: 50,
    good: 60,
    veryGood: 75,
  },
  savePercentage: {
    poor: 50,
    decent: 60,
    good: 70,
    veryGood: 80,
  },
};

// ? Color scheme
const QUALITY_COLORS: Record<QualityLevel, QualityInfo> = {
  poor: {
    level: "poor",
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Ruim",
  },
  decent: {
    level: "decent",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    label: "Razoável",
  },
  good: {
    level: "good",
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Bom",
  },
  veryGood: {
    level: "veryGood",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Excelente",
  },
};

// ? Main classification function
export function classifyStat(statType: string, value: number): QualityInfo | null {
  const thresholds = STAT_THRESHOLDS[statType];
  if (!thresholds || !Number.isFinite(value)) return null;

  if (value < thresholds.poor) return QUALITY_COLORS.poor;
  if (value < thresholds.decent) return QUALITY_COLORS.decent;
  if (value < thresholds.good) return QUALITY_COLORS.good;
  return QUALITY_COLORS.veryGood;
}

// ? Helper function to calculate shot-to-goal conversion
export function calculateShotToGoalConversion(goals: number, shots: number): number {
  if (!shots || shots === 0) return 0;
  return (goals / shots) * 100;
}

// ? Get detailed quality information with tier distances
export function getStatQualityDetails(statType: string, value: number): string | null {
  const thresholds = STAT_THRESHOLDS[statType];
  const quality = classifyStat(statType, value);

  if (!thresholds || !quality || !Number.isFinite(value)) return null;

  const statNames: Record<string, string> = {
    shotToGoalConversion: "Conversão de chutes",
    shotsOnTarget: "Chutes no gol",
    passCompletion: "Precisão de passe",
    goalsPerMatch: "Gols por partida",
    tackleDuelWin: "Sucesso nos desarmes",
    teamPossession: "Posse de bola",
    winRate: "Taxa de vitória",
    savePercentage: "% de defesas",
  };

  const statName = statNames[statType] || statType;
  const lines: string[] = [`${statName}: ${value.toFixed(1)}% (${quality.label})`];

  // ? Find next tier
  if (quality.level !== "veryGood") {
    const nextThreshold =
      quality.level === "poor" ? thresholds.decent : quality.level === "decent" ? thresholds.good : thresholds.veryGood;
    const nextLabel = quality.level === "poor" ? "Razoável" : quality.level === "decent" ? "Bom" : "Excelente";
    const diff = nextThreshold - value;
    lines.push(`↑ Próximo nível (${nextLabel}): +${diff.toFixed(1)}%`);
  } else {
    lines.push("✓ Nível máximo alcançado!");
  }

  // ? Find previous tier
  if (quality.level !== "poor") {
    const prevThreshold =
      quality.level === "veryGood" ? thresholds.good : quality.level === "good" ? thresholds.decent : thresholds.poor;
    const prevLabel = quality.level === "veryGood" ? "Bom" : quality.level === "good" ? "Razoável" : "Ruim";
    const diff = value - prevThreshold;
    lines.push(`↓ Nível anterior (${prevLabel}): -${diff.toFixed(1)}%`);
  }

  return lines.join("\n");
}
