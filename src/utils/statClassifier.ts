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
    good: 70,
    veryGood: 70,
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
