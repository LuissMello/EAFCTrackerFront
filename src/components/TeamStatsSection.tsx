import React, { useMemo } from "react";
import { ClubStats } from "../types/stats.ts";
import { classifyStat, QualityInfo } from "../utils/statClassifier.ts";
import { StatQualityIndicator } from "./StatQualityIndicator.tsx";

interface TeamStatsSectionProps {
  clubStats: ClubStats | null;
  loading: boolean;
  error: string | null;
  hiddenStats?: string[];
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

function useNumberFormats() {
  const int = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
  const p1 = useMemo(() => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }), []);
  const p2 = useMemo(() => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  return { int, p1, p2 };
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-2xl ${className}`} />;
}

function qualityBarColor(level: string): string {
  switch (level) {
    case "poor":    return "bg-red-500";
    case "decent":  return "bg-orange-500";
    case "good":    return "bg-green-500";
    case "veryGood":return "bg-blue-500";
    default:        return "bg-blue-500";
  }
}

function ratingColor(rating: number): string {
  if (rating >= 7.5) return "text-blue-600";
  if (rating >= 7.0) return "text-green-600";
  if (rating >= 6.0) return "text-orange-500";
  return "text-red-600";
}

function ratingBarColor(rating: number): string {
  if (rating >= 7.5) return "bg-blue-500";
  if (rating >= 7.0) return "bg-green-500";
  if (rating >= 6.0) return "bg-orange-500";
  return "bg-red-500";
}

const QUALITY_TEXT_COLOR: Record<string, string> = {
  poor:    "text-red-600",
  decent:  "text-orange-500",
  good:    "text-green-600",
  veryGood:"text-blue-600",
};

function TinyBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  if (total === 0) return <div className="h-1 bg-gray-100 rounded-full mt-1.5" />;
  return (
    <div className="flex h-1 rounded-full overflow-hidden w-full gap-px mt-1.5">
      {wins   > 0 && <div className="bg-green-500" style={{ width: `${(wins   / total) * 100}%` }} />}
      {draws  > 0 && <div className="bg-gray-400"  style={{ width: `${(draws  / total) * 100}%` }} />}
      {losses > 0 && <div className="bg-red-500"   style={{ width: `${(losses / total) * 100}%` }} />}
    </div>
  );
}

/** Card genérico — dot de qualidade fica no header, não inline com o valor */
function StatCard({
  label,
  value,
  valueSize = "2xl",
  sub,
  statType,
  rawValue,
  bar,
  subQuality,
}: {
  label: string;
  value: React.ReactNode;
  valueSize?: "lg" | "xl" | "2xl";
  sub?: React.ReactNode;
  statType?: string;
  rawValue?: number;
  bar?: React.ReactNode;
  subQuality?: QualityInfo | null;
}) {
  const quality = statType && rawValue !== undefined ? classifyStat(statType, rawValue) : null;
  const subColorClass = subQuality ? QUALITY_TEXT_COLOR[subQuality.level] : "text-gray-500";
  const sizeClass = valueSize === "2xl" ? "text-2xl" : valueSize === "xl" ? "text-xl" : "text-lg";

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-1 hover:shadow-md transition-shadow min-w-0">
      {/* Header: label + quality dot */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="text-xs text-gray-500 truncate leading-tight">{label}</div>
        {quality && (
          <StatQualityIndicator quality={quality} size="small" statType={statType} value={rawValue} />
        )}
      </div>

      {/* Value */}
      <div className={`${sizeClass} font-bold leading-tight min-w-0 overflow-hidden`}>
        {value}
      </div>

      {bar}

      {sub != null ? (
        <div className={`text-xs min-w-0 ${typeof sub === "string" ? subColorClass : ""}`}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function TeamStatsSection({ clubStats, loading, error, hiddenStats = [] }: TeamStatsSectionProps) {
  const { int, p1, p2 } = useNumberFormats();

  if (loading && !clubStats) {
    return (
      <section className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </section>
    );
  }

  if (!loading && !clubStats && !error) {
    return (
      <section className="mb-6">
        <div className="p-3 bg-gray-50 rounded border text-gray-700">Sem estatísticas de clube disponíveis.</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <div className="p-3 bg-red-50 rounded border border-red-200 text-red-700">{error}</div>
      </section>
    );
  }

  if (!clubStats) return null;

  const passPct    = pct(clubStats.totalPassesMade,   clubStats.totalPassAttempts);
  const tacklePct  = pct(clubStats.totalTacklesMade,  clubStats.totalTackleAttempts);
  const passQuality   = classifyStat("passCompletion",       passPct);
  const tackleQuality = classifyStat("tackleDuelWin",        tacklePct);
  const shotQuality   = classifyStat("shotToGoalConversion", clubStats.goalAccuracyPercent);
  const winQuality    = classifyStat("winRate",              clubStats.winPercent);
  const goalDiff  = clubStats.totalGoals - (clubStats.totalGoalsConceded ?? 0);
  const rating    = Number(clubStats.avgRating || 0);
  const wins      = clubStats.totalWins;
  const draws     = clubStats.totalDraws;
  const losses    = clubStats.totalLosses;

  const statCards = [
    {
      id: "matches",
      label: "Partidas",
      value: int.format(clubStats.matchesPlayed),
      valueSize: "2xl" as const,
    },
    {
      id: "goals",
      label: "Gols",
      // Valor principal: só os gols (grande), assists e pré no sub
      value: int.format(clubStats.totalGoals),
      valueSize: "2xl" as const,
      sub: (
        <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
          <span><strong className="text-gray-700">{int.format(clubStats.totalAssists)}</strong> assist.</span>
          <span>·</span>
          <span><strong className="text-gray-700">{int.format(clubStats.totalPreAssists ?? 0)}</strong> pré</span>
          <span>·</span>
          <span className={goalDiff > 0 ? "text-green-600 font-medium" : goalDiff < 0 ? "text-red-600 font-medium" : ""}>
            {goalDiff > 0 ? `+${goalDiff}` : goalDiff} saldo
          </span>
        </span>
      ),
    },
    {
      id: "shots",
      label: "Chutes",
      value: <span className="whitespace-nowrap">{int.format(clubStats.totalGoals)} / {int.format(clubStats.totalShots)}</span>,
      valueSize: "xl" as const,
      sub: `${p1.format(clubStats.goalAccuracyPercent)}% de conversão`,
      statType: "shotToGoalConversion",
      rawValue: clubStats.goalAccuracyPercent,
      bar: <TinyBar value={clubStats.goalAccuracyPercent} color={shotQuality ? qualityBarColor(shotQuality.level) : "bg-blue-500"} />,
      subQuality: shotQuality,
    },
    {
      id: "passes",
      label: "Passes",
      value: <span className="whitespace-nowrap">{int.format(clubStats.totalPassesMade)} / {int.format(clubStats.totalPassAttempts)}</span>,
      valueSize: "xl" as const,
      sub: `${p1.format(passPct)}% de acerto`,
      statType: "passCompletion",
      rawValue: passPct,
      bar: <TinyBar value={passPct} color={passQuality ? qualityBarColor(passQuality.level) : "bg-blue-500"} />,
      subQuality: passQuality,
    },
    {
      id: "tackles",
      label: "Desarmes",
      value: <span className="whitespace-nowrap">{int.format(clubStats.totalTacklesMade)} / {int.format(clubStats.totalTackleAttempts)}</span>,
      valueSize: "xl" as const,
      sub: `${p1.format(tacklePct)}% de sucesso`,
      statType: "tackleDuelWin",
      rawValue: tacklePct,
      bar: <TinyBar value={tacklePct} color={tackleQuality ? qualityBarColor(tackleQuality.level) : "bg-blue-500"} />,
      subQuality: tackleQuality,
    },
    {
      id: "results",
      label: "Resultados",
      // Números grandes com letra pequena abaixo — evita quebra
      value: (
        <div className="flex items-end gap-2">
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-bold text-green-600">{int.format(wins)}</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">V</span>
          </div>
          <span className="text-gray-200 text-xl mb-3">/</span>
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-bold text-gray-500">{int.format(draws)}</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">E</span>
          </div>
          <span className="text-gray-200 text-xl mb-3">/</span>
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-bold text-red-600">{int.format(losses)}</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">D</span>
          </div>
        </div>
      ),
      sub: `${p1.format(clubStats.winPercent)}% vitórias`,
      statType: "winRate",
      rawValue: clubStats.winPercent,
      bar: <RecordBar wins={wins} draws={draws} losses={losses} />,
      subQuality: winQuality,
    },
    {
      id: "cards",
      label: "Cartões / MOM",
      value: (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-bold text-red-600">{int.format(clubStats.totalRedCards)}</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">vermelhos</span>
          </div>
          <span className="text-gray-200 text-xl pb-4">/</span>
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-bold text-yellow-500">{int.format(clubStats.totalMom)}</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">MOM 🏆</span>
          </div>
        </div>
      ),
    },
    {
      id: "rating",
      label: "Nota média",
      value: <span className={ratingColor(rating)}>{p2.format(rating)}</span>,
      valueSize: "2xl" as const,
      bar: <TinyBar value={(rating / 10) * 100} color={ratingBarColor(rating)} />,
      sub: rating >= 7.5 ? "Excelente" : rating >= 7.0 ? "Bom" : rating >= 6.0 ? "Razoável" : "Ruim",
      subQuality: classifyStat("winRate", rating >= 7.5 ? 80 : rating >= 7.0 ? 65 : rating >= 6.0 ? 45 : 20),
    },
  ];

  const visibleStats = statCards.filter((stat) => !hiddenStats.includes(stat.id));

  return (
    <section className="mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleStats.map((stat) => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            valueSize={stat.valueSize}
            sub={stat.sub}
            statType={stat.statType}
            rawValue={stat.rawValue}
            bar={stat.bar}
            subQuality={stat.subQuality}
          />
        ))}
      </div>
    </section>
  );
}
