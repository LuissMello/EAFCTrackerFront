import React, { useMemo } from "react";
import { ClubStats } from "../types/stats.ts";
import { classifyStat } from "../utils/statClassifier.ts";
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
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatCard({
  label,
  value,
  sub,
  statType,
  rawValue,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  statType?: string;
  rawValue?: number;
}) {
  const quality = statType && rawValue !== undefined ? classifyStat(statType, rawValue) : null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold leading-tight flex items-center gap-2">
        {value}
        {quality && <StatQualityIndicator quality={quality} size="medium" statType={statType} value={rawValue} />}
      </div>
      {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

export function TeamStatsSection({ clubStats, loading, error, hiddenStats = [] }: TeamStatsSectionProps) {
  const { int, p1, p2 } = useNumberFormats();

  if (loading && !clubStats) {
    return (
      <section className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
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

  const statCards = [
    {
      id: "matches",
      label: "Partidas",
      value: int.format(clubStats.matchesPlayed),
    },
    {
      id: "goals",
      label: "Gols / Assist.",
      value: `${int.format(clubStats.totalGoals)} / ${int.format(clubStats.totalAssists)}`,
    },
    {
      id: "shots",
      label: "Chutes (G/T)",
      value: `${int.format(clubStats.totalGoals)} / ${int.format(clubStats.totalShots)}`,
      sub: `${p1.format(clubStats.goalAccuracyPercent)}% de conversão`,
      statType: "shotToGoalConversion",
      rawValue: clubStats.goalAccuracyPercent,
    },
    {
      id: "passes",
      label: "Passes (C/T)",
      value: `${int.format(clubStats.totalPassesMade)} / ${int.format(clubStats.totalPassAttempts)}`,
      sub: `${p1.format(pct(clubStats.totalPassesMade, clubStats.totalPassAttempts))}% de acerto`,
      statType: "passCompletion",
      rawValue: pct(clubStats.totalPassesMade, clubStats.totalPassAttempts),
    },
    {
      id: "tackles",
      label: "Desarmes (C/T)",
      value: `${int.format(clubStats.totalTacklesMade)} / ${int.format(clubStats.totalTackleAttempts)}`,
      sub: `${p1.format(pct(clubStats.totalTacklesMade, clubStats.totalTackleAttempts))}% de sucesso`,
      statType: "tackleDuelWin",
      rawValue: pct(clubStats.totalTacklesMade, clubStats.totalTackleAttempts),
    },
    {
      id: "results",
      label: "Resultados",
      value: `${int.format(clubStats.totalWins)}V / ${int.format(clubStats.totalDraws)}E / ${int.format(
        clubStats.totalLosses
      )}D`,
      sub: `${p1.format(clubStats.winPercent)}% vitórias`,
      statType: "winRate",
      rawValue: clubStats.winPercent,
    },
    {
      id: "cards",
      label: "Vermelhos / MOM",
      value: `${int.format(clubStats.totalRedCards)} / ${int.format(clubStats.totalMom)}`,
    },
    {
      id: "rating",
      label: "Nota média",
      value: p2.format(Number(clubStats.avgRating || 0)),
    },
  ];

  const visibleStats = statCards.filter((stat) => !hiddenStats.includes(stat.id));

  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleStats.map((stat) => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            sub={stat.sub}
            statType={stat.statType}
            rawValue={stat.rawValue}
          />
        ))}
      </div>
    </section>
  );
}
