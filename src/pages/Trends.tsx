import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api.ts';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Result = 'W' | 'D' | 'L';

interface MatchTrendPointDto {
    matchId: number;
    timestamp: string;
    opponentClubId: number;
    opponentName: string;
    goalsFor: number;
    goalsAgainst: number;
    result: Result | string;
    shots: number;
    passesMade: number;
    passAttempts: number;
    passAccuracyPercent: number;
    tacklesMade: number;
    tackleAttempts: number;
    tackleSuccessPercent: number;
    avgRating: number;
    momOccurred: boolean;
}

interface ClubTrendsDto {
    clubId: number;
    clubName: string;
    series: MatchTrendPointDto[];
    formLast5: string;
    formLast10: string;
    currentUnbeaten: number;
    currentWins: number;
    currentCleanSheets: number;
    movingAvgPassAcc_5: number[];
    movingAvgRating_5: number[];
    movingAvgTackleAcc_5: number[];
}

interface TopItemDto {
    playerEntityId: number;
    playerId: number;
    playerName: string;
    clubId: number;
    goals: number;
    assists: number;
    matches: number;
    avgRating: number;
    mom: number;
}

export default function TrendsPage({ clubId = 3463149 }: { clubId?: number }) {
    const [last, setLast] = useState(20);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ClubTrendsDto | null>(null);
    const [tops, setTops] = useState<TopItemDto[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                setLoading(true); setError(null);
                const [t1, t2] = await Promise.all([
                    api.get<ClubTrendsDto>(`https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Trends/club/${clubId}?last=${last}`),
                    api.get<TopItemDto[]>(`https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Trends/top-scorers?clubId=${clubId}&limit=10`)
                ]);
                if (!cancel) {
                    setData(t1.data);
                    setTops(t2.data);
                }
            } catch (e: any) {
                if (!cancel) setError(e?.message ?? 'Erro ao carregar tendências');
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, [clubId, last]);

    const labels = useMemo(
        () => (data?.series ?? []).map(p => new Date(p.timestamp).toLocaleDateString('pt-BR')),
        [data]
    );

    const passData = useMemo(() => ({
        labels,
        datasets: [
            { label: 'Pass Accuracy (média móvel 5)', data: data?.movingAvgPassAcc_5 ?? [] }
        ]
    }), [labels, data]);

    const tackleData = useMemo(() => ({
        labels,
        datasets: [
            { label: 'Tackle Success (média móvel 5)', data: data?.movingAvgTackleAcc_5 ?? [] }
        ]
    }), [labels, data]);

    const ratingData = useMemo(() => ({
        labels,
        datasets: [
            { label: 'Nota Média (móvel 5)', data: data?.movingAvgRating_5 ?? [] }
        ]
    }), [labels, data]);

    const lineOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
    };

    const lastResults = (data?.series ?? []).map(s => s.result as Result);
    const pillColor = (r: Result) =>
        r === 'W' ? 'bg-green-600' : r === 'D' ? 'bg-gray-500' : 'bg-red-600';

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6">
            <div className="flex items-end justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold">Tendências & Streaks — {data?.clubName ?? ''}</h1>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Últimos</label>
                    <input
                        type="number"
                        className="border rounded px-2 py-1 w-24"
                        min={5}
                        value={last}
                        onChange={e => setLast(Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="text-sm text-gray-700">jogos</span>
                </div>
            </div>

            {loading && <div className="p-3 bg-white border rounded">Carregando…</div>}
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
            {!loading && !error && data && (
                <>
                    {/* Cards de forma e streaks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white border rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-1">Forma (Últimos 5)</div>
                            <div className="font-mono">{data.formLast5 || '—'}</div>
                        </div>
                        <div className="bg-white border rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-1">Forma (Últimos 10)</div>
                            <div className="font-mono">{data.formLast10 || '—'}</div>
                        </div>
                        <div className="bg-white border rounded-xl p-4">
                            <div className="grid grid-cols-3 text-center">
                                <div>
                                    <div className="text-xs text-gray-500">Sem perder</div>
                                    <div className="text-xl font-bold">{data.currentUnbeaten}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Vitórias seguidas</div>
                                    <div className="text-xl font-bold">{data.currentWins}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Clean sheets</div>
                                    <div className="text-xl font-bold">{data.currentCleanSheets}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Linha do tempo W/D/L */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="text-sm font-semibold mb-2">Linha do tempo (W/D/L)</div>
                        <div className="flex flex-wrap gap-2">
                            {data.series.map((s) => (
                                <div key={s.matchId} className="flex items-center gap-2">
                                    <span className={`text-white text-xs px-2 py-1 rounded ${pillColor(s.result as Result)}`}>
                                        {s.result}
                                    </span>
                                    <span className="text-xs text-gray-600">{new Date(s.timestamp).toLocaleDateString('pt-BR')}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white border rounded-xl p-4 h-[260px]">
                            <Line data={passData as any} options={lineOptions} />
                        </div>
                        <div className="bg-white border rounded-xl p-4 h-[260px]">
                            <Line data={tackleData as any} options={lineOptions} />
                        </div>
                        <div className="bg-white border rounded-xl p-4 h-[260px]">
                            <Line data={ratingData as any} options={lineOptions} />
                        </div>
                    </div>

                    {/* Top performers */}
                    <div className="bg-white border rounded-xl p-4">
                        <h2 className="text-lg font-semibold mb-2">Top Performers (período)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full table-auto text-sm text-center border">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-left">Jogador</th>
                                        <th className="p-2">Partidas</th>
                                        <th className="p-2">Gols</th>
                                        <th className="p-2">Assistências</th>
                                        <th className="p-2">MOM</th>
                                        <th className="p-2">Nota média</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tops.map(t => (
                                        <tr key={t.playerEntityId} className="border-t">
                                            <td className="p-2 text-left">{t.playerName}</td>
                                            <td className="p-2">{t.matches}</td>
                                            <td className="p-2">{t.goals}</td>
                                            <td className="p-2">{t.assists}</td>
                                            <td className="p-2">{t.mom}</td>
                                            <td className="p-2">{t.avgRating.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </>
            )}
        </div>
    );
}
