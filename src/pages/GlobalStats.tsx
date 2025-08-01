import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface PlayerStats {
    playerId: number;
    playerName: string;
    clubId: number;
    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;
    avgRating: number;
    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
    winPercent: number;
}

interface ClubStats {
    clubId: number;
    clubName: string;
    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;
    avgRating: number;
    winPercent: number;
    passAccuracyPercent: number;
    goalAccuracyPercent: number;
}

type SortKey = keyof PlayerStats;
type SortOrder = 'asc' | 'desc';

export default function PlayerStatisticsPage() {
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [clubStats, setClubStats] = useState<ClubStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [matchCount, setMatchCount] = useState<number>(5);
    const [sortKey, setSortKey] = useState<SortKey>('totalGoals');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const fetchStats = async (count: number) => {
        try {
            setLoading(true);
            console.log("Buscando estatísticas com count =", count);
            const res = await fetch(
                `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/statistics/limited?count=${count}`
            );
            const data = await res.json();
            setPlayers(data.players);
            setClubStats(data.clubs?.[0] || null);
        } catch (err) {
            console.error('Erro ao buscar estatísticas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats(matchCount);
    }, []);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };

    const sortedPlayers = [...players].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return sortOrder === 'asc'
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
    });

    const sortIcon = (key: SortKey) =>
        sortKey === key ? (sortOrder === 'asc' ? '▲' : '▼') : '';

    const calcPercent = (made: number, attempts: number) =>
        attempts > 0 ? ((made / attempts) * 100).toFixed(1) : '0.0';

    // Cabeçalhos de tabela de jogadores
    const playerColumns: [SortKey, string][] = [
        ['playerName', 'Jogador'],
        ['matchesPlayed', 'Partidas'],
        ['totalGoals', 'Gols'],
        ['totalAssists', 'Assistências'],
        ['totalShots', 'Chutes / Precisão'],
        ['totalPassesMade', 'Passes Feitos / Tentativas'],
        ['totalTacklesMade', 'Desarmes Feitos / Tentativas'],
        ['totalWins', 'Vitórias'],
        ['totalLosses', 'Derrotas'],
        ['totalDraws', 'Empates'],
        ['winPercent', 'Win %'],
        ['totalRedCards', 'Vermelhos'],
        ['totalMom', 'MOM'],
        ['avgRating', 'Nota Média'],
    ];

    return (
        <div className="p-6 max-w-[95vw] mx-auto font-medium">
            <h1 className="text-3xl font-bold mb-4 text-center">Estatísticas</h1>

            {/* Controle de quantidade */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <label className="text-base" htmlFor="matchCount">
                    Mostrar últimos:
                </label>
                <input
                    id="matchCount"
                    type="number"
                    value={matchCount}
                    onChange={(e) => setMatchCount(parseInt(e.target.value) || 1)}
                    className="border px-2 py-1 rounded w-20 text-center"
                    min={1}
                />
                <button
                    onClick={() => {
                        const input = document.getElementById('matchCount') as HTMLInputElement;
                        const value = parseInt(input.value) || 1;
                        setMatchCount(value);
                        fetchStats(value);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
                >
                    Buscar
                </button>
            </div>

            {/* Tabela do clube */}
            {clubStats && (
                <>
                    <h2 className="text-xl font-bold mb-2 text-center">Estatísticas do Clube</h2>
                    <div className="overflow-x-auto">
                        <table className="table-auto w-full border border-gray-300 text-sm text-center whitespace-nowrap bg-white shadow rounded-lg">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-3 py-2">Clube</th>
                                    <th className="px-3 py-2">Gols</th>
                                    <th className="px-3 py-2">Assistências</th>
                                    <th className="px-3 py-2">Chutes / Precisão</th>
                                    <th className="px-3 py-2">Passes Feitos / Tentativas</th>
                                    <th className="px-3 py-2">Desarmes Feitos / Tentativas</th>
                                    <th className="px-3 py-2">Vitórias / %</th>
                                    <th className="px-3 py-2">Empates</th>
                                    <th className="px-3 py-2">Derrotas</th>
                                    <th className="px-3 py-2">Vermelhos</th>
                                    <th className="px-3 py-2">MOM</th>
                                    <th className="px-3 py-2">Nota Média</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-semibold">{clubStats.clubName}</td>
                                    <td className="px-3 py-2">{clubStats.totalGoals}</td>
                                    <td className="px-3 py-2">{clubStats.totalAssists}</td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalShots} / {clubStats.goalAccuracyPercent.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalPassesMade} / {clubStats.totalPassAttempts} (
                                        {calcPercent(clubStats.totalPassesMade, clubStats.totalPassAttempts)}%)
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalTacklesMade} / {clubStats.totalTackleAttempts} (
                                        {calcPercent(clubStats.totalTacklesMade, clubStats.totalTackleAttempts)}%)
                                    </td>
                                    <td className="px-3 py-2">
                                        {clubStats.totalWins} / {clubStats.winPercent.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2">{clubStats.totalDraws}</td>
                                    <td className="px-3 py-2">{clubStats.totalLosses}</td>
                                    <td className="px-3 py-2">{clubStats.totalRedCards}</td>
                                    <td className="px-3 py-2">{clubStats.totalMom}</td>
                                    <td className="px-3 py-2">{clubStats.avgRating.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Tabela de jogadores */}
            <h2 className="text-xl font-bold mt-10 mb-2 text-center">Estatísticas dos Jogadores</h2>
            <div className="overflow-x-auto">
                <table className="table-auto w-full border border-gray-300 text-sm text-center whitespace-nowrap bg-white shadow rounded-lg">
                    <thead className="bg-gray-100">
                        <tr>
                            {playerColumns.map(([key, label]) => (
                                <th
                                    key={key}
                                    onClick={() => handleSort(key)}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-200"
                                >
                                    {label} {sortIcon(key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPlayers.map((player) => (
                            <tr key={player.playerId} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-blue-600 underline">
                                    <Link to={`/statistics/player/${player.playerId}`}>{player.playerName}</Link>
                                </td>
                                <td className="px-3 py-2">{player.matchesPlayed}</td>
                                <td className="px-3 py-2">{player.totalGoals}</td>
                                <td className="px-3 py-2">{player.totalAssists}</td>
                                <td className="px-3 py-2">
                                    {player.totalShots} / {player.goalAccuracyPercent.toFixed(1)}%
                                </td>
                                <td className="px-3 py-2">
                                    {player.totalPassesMade} / {player.totalPassAttempts} (
                                    {calcPercent(player.totalPassesMade, player.totalPassAttempts)}%)
                                </td>
                                <td className="px-3 py-2">
                                    {player.totalTacklesMade} / {player.totalTackleAttempts} (
                                    {calcPercent(player.totalTacklesMade, player.totalTackleAttempts)}%)
                                </td>
                                <td className="px-3 py-2">{player.totalWins}</td>
                                <td className="px-3 py-2">{player.totalLosses}</td>
                                <td className="px-3 py-2">{player.totalDraws}</td>
                                <td className="px-3 py-2">{player.winPercent.toFixed(1)}%</td>
                                <td className="px-3 py-2">{player.totalRedCards}</td>
                                <td className="px-3 py-2">{player.totalMom}</td>
                                <td className="px-3 py-2">{player.avgRating.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
