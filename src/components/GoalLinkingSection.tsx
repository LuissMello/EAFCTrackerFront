import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api.ts";

interface PlayerRow {
  playerId: number;
  playerName: string;
  proName?: string;
  clubId: number;
  totalGoals: number;
  totalAssists: number;
}

interface GoalLinkingSectionProps {
  matchId: string;
  clubId: number;
  clubName: string;
  clubCrestAssetId?: string | null;
  players: PlayerRow[];
}

interface GoalLink {
  scorerPlayerId: number;
  goalIndex: number;
  assistPlayerId: number | null;
  preAssistPlayerId: number | null;
}

const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const crestUrl = (id?: string | null) =>
  id
    ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
    : FALLBACK_LOGO;

export function GoalLinkingSection({
  matchId,
  clubName,
  clubCrestAssetId,
  players,
}: GoalLinkingSectionProps) {
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to get display name (proName with fallback to playerName)
  const getDisplayName = (player: PlayerRow): string => {
    return player.proName || player.playerName;
  };

  const getPlayerDisplayName = (playerId: number | null): string => {
    if (playerId === null) return "-";
    const player = players.find((p) => p.playerId === playerId);
    if (!player) return "-";
    return getDisplayName(player);
  };

  // Generate goal rows from players with goals
  const initialGoalLinks = useMemo(() => {
    const rows: GoalLink[] = [];
    const scorers = players.filter((p) => p.totalGoals > 0);

    scorers.forEach((player) => {
      for (let i = 0; i < player.totalGoals; i++) {
        rows.push({
          scorerPlayerId: player.playerId,
          goalIndex: i + 1,
          assistPlayerId: null,
          preAssistPlayerId: null,
        });
      }
    });

    return rows;
  }, [players]);

  // Initialize goal links on mount
  useEffect(() => {
    setGoalLinks(initialGoalLinks);
  }, [initialGoalLinks]);

  // Players with at least one assist (base list, will be filtered per row)
  const playersWithAssists = useMemo(
    () => players.filter((p) => p.totalAssists > 0),
    [players]
  );

  // Count how many times each player has been assigned as assist
  const usedAssistCounts = useMemo(() => {
    const counts = new Map<number, number>();
    goalLinks.forEach((g) => {
      if (g.assistPlayerId !== null) {
        counts.set(g.assistPlayerId, (counts.get(g.assistPlayerId) ?? 0) + 1);
      }
    });
    return counts;
  }, [goalLinks]);

  // Get eligible assist candidates for a specific goal
  // - Excludes scorer
  // - Excludes players who have used all their available assists (unless they're the current selection)
  const getAssistCandidates = (goal: GoalLink): PlayerRow[] => {
    return playersWithAssists.filter((p) => {
      // Can't assist your own goal
      if (p.playerId === goal.scorerPlayerId) return false;

      // Always show the currently selected player
      if (p.playerId === goal.assistPlayerId) return true;

      // Check if player still has assists available
      const usedCount = usedAssistCounts.get(p.playerId) ?? 0;
      return usedCount < p.totalAssists;
    });
  };

  // Get eligible pre-assist candidates for a specific goal (excludes scorer and assist)
  const getPreAssistCandidates = (goal: GoalLink): PlayerRow[] => {
    return players.filter(
      (p) => p.playerId !== goal.scorerPlayerId && p.playerId !== goal.assistPlayerId
    );
  };

  const handleAssistChange = (index: number, playerId: number | null) => {
    setGoalLinks((prev) =>
      prev.map((g, i) => {
        if (i !== index) return g;
        // Clear pre-assist if assist is cleared OR if new assist equals current pre-assist
        const shouldClearPreAssist =
          playerId === null || playerId === g.preAssistPlayerId;
        return {
          ...g,
          assistPlayerId: playerId,
          preAssistPlayerId: shouldClearPreAssist ? null : g.preAssistPlayerId,
        };
      })
    );
  };

  const handlePreAssistChange = (index: number, playerId: number | null) => {
    setGoalLinks((prev) =>
      prev.map((g, i) => (i === index ? { ...g, preAssistPlayerId: playerId } : g))
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/Matches/${matchId}/goals`, {
        goals: goalLinks.map((g) => ({
          scorerPlayerEntityId: g.scorerPlayerId,
          assistPlayerEntityId: g.assistPlayerId,
          preAssistPlayerEntityId: g.preAssistPlayerId,
        })),
      });
      setSaved(true);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao salvar vínculos");
    } finally {
      setSaving(false);
    }
  };

  // Check if there are multiple goals by the same player
  const hasMultipleGoals = useMemo(() => {
    const goalsPerPlayer = new Map<number, number>();
    players.forEach((p) => {
      if (p.totalGoals > 0) {
        goalsPerPlayer.set(p.playerId, p.totalGoals);
      }
    });
    return Array.from(goalsPerPlayer.values()).some((count) => count > 1);
  }, [players]);

  const formatScorerName = (goal: GoalLink) => {
    const player = players.find((p) => p.playerId === goal.scorerPlayerId);
    const name = player ? getDisplayName(player) : "Desconhecido";

    if (hasMultipleGoals) {
      const playerGoals = player?.totalGoals ?? 1;
      if (playerGoals > 1) {
        return `${name} (${goal.goalIndex})`;
      }
    }
    return name;
  };

  // No goals case
  if (goalLinks.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-xl p-4 border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <img
            src={crestUrl(clubCrestAssetId)}
            onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
            alt={`Escudo ${clubName}`}
            className="w-6 h-6 rounded-full bg-white border"
          />
          {clubName} - Vincular Assistências
        </h3>
        <p className="text-sm text-gray-600">Nenhum gol marcado nesta partida.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-xl p-4 border">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <img
          src={crestUrl(clubCrestAssetId)}
          onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
          alt={`Escudo ${clubName}`}
          className="w-6 h-6 rounded-full bg-white border"
        />
        {clubName} - {saved ? "Assistências Vinculadas" : "Vincular Assistências"}
      </h3>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-auto text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left font-medium">Gol</th>
              <th className="p-2 text-center text-gray-400 w-8"></th>
              <th className="p-2 text-left font-medium">Assistência</th>
              <th className="p-2 text-center text-gray-400 w-8"></th>
              <th className="p-2 text-left font-medium">Pré-Assistência</th>
            </tr>
          </thead>
          <tbody>
            {goalLinks.map((goal, index) => {
              const assistCandidates = getAssistCandidates(goal);
              const preAssistCandidates = getPreAssistCandidates(goal);

              return (
                <tr key={`${goal.scorerPlayerId}-${goal.goalIndex}`} className="border-t">
                  <td className="p-2 font-medium">{formatScorerName(goal)}</td>
                  <td className="p-2 text-center text-gray-400">←</td>
                  <td className="p-2">
                    {saved ? (
                      <span>{getPlayerDisplayName(goal.assistPlayerId)}</span>
                    ) : (
                      <select
                        value={goal.assistPlayerId ?? ""}
                        onChange={(e) =>
                          handleAssistChange(
                            index,
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="border rounded px-2 py-1 text-sm w-full max-w-[200px]"
                      >
                        <option value="">Selecionar...</option>
                        {assistCandidates.map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {getDisplayName(p)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2 text-center text-gray-400">←</td>
                  <td className="p-2">
                    {saved ? (
                      <span>{getPlayerDisplayName(goal.preAssistPlayerId)}</span>
                    ) : (
                      <select
                        value={goal.preAssistPlayerId ?? ""}
                        onChange={(e) =>
                          handlePreAssistChange(
                            index,
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        disabled={goal.assistPlayerId === null}
                        className="border rounded px-2 py-1 text-sm w-full max-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecionar...</option>
                        {preAssistCandidates.map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {getDisplayName(p)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!saved && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Salvar Vínculos"}
          </button>
        </div>
      )}
    </div>
  );
}
