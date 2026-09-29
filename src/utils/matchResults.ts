// src/utils/matchResults.ts — helpers de datas e perspectiva ("meu clube") para a lista de partidas
import type { MatchResultDto } from "../types/match.ts";
import { parseTimestamp } from "./date.ts";

export const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

const fmtCompactDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtCompactTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Data compacta em duas linhas (dd/mm + hh:mm) para a lista densa. */
export function compactWhen(ts?: string | number | null): { date: string; time: string } {
  const d = parseTimestamp(ts);
  if (!d) return { date: "—", time: "" };
  return { date: fmtCompactDate.format(d), time: fmtCompactTime.format(d) };
}

export function formatDateSafe(ts?: string | number | null, fallback = "—"): string {
  const d = parseTimestamp(ts);
  return d ? fmtDateTime.format(d) : fallback;
}

export function timeValue(ts?: string | number | null, whenInvalid = -Infinity) {
  const d = parseTimestamp(ts);
  return d ? d.getTime() : whenInvalid;
}

export function perspectiveForByNameOrTeam(m: MatchResultDto, myClubName?: string | null, myTeamIdNum?: number) {
  if (typeof myTeamIdNum === "number" && Number.isFinite(myTeamIdNum)) {
    if (m.clubADetails?.teamId === myTeamIdNum || m.clubADetails?.TeamId === myTeamIdNum)
      return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
    if (m.clubBDetails?.teamId === myTeamIdNum || m.clubBDetails?.TeamId === myTeamIdNum)
      return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }
  const name = (myClubName ?? "").toLowerCase();
  if (name) {
    if ((m.clubAName ?? "").toLowerCase() === name)
      return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
    if ((m.clubBName ?? "").toLowerCase() === name)
      return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }
  return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
}

export function perspectiveForSelected(
  m: MatchResultDto,
  selectedClubIds: number[],
  fallbackClubName?: string | null,
  fallbackTeamId?: number
) {
  const aId = m.clubADetails?.clubId ?? null;
  const bId = m.clubBDetails?.clubId ?? null;

  if (aId && selectedClubIds.includes(Number(aId))) {
    return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
  }
  if (bId && selectedClubIds.includes(Number(bId))) {
    return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }

  return perspectiveForByNameOrTeam(m, fallbackClubName, fallbackTeamId);
}
