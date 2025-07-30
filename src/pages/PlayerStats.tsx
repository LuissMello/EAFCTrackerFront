import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.ts';

interface PlayerStatsParams {
  matchId: string;
  playerId: string;
}

interface PlayerMatchStatsDto {
  aceleracao: number;
  pique: number;
  finalizacao: number;
  falta: number;
  cabeceio: number;
  forcaDoChute: number;
  chuteLonge: number;
  voleio: number;
  penalti: number;
  visao: number;
  cruzamento: number;
  lancamento: number;
  passeCurto: number;
  curva: number;
  agilidade: number;
  equilibrio: number;
  posAtaqueInutil: number;
  controleBola: number;
  conducao: number;
  interceptacaos: number;
  nocaoDefensiva: number;
  divididaEmPe: number;
  carrinho: number;
  impulsao: number;
  folego: number;
  forca: number;
  reacao: number;
  combatividade: number;
  frieza: number;
  elasticidadeGL: number;
  manejoGL: number;
  chuteGL: number;
  reflexosGL: number;
  posGL: number;
}

interface MatchPlayerStatsDto {
  playerId: number;
  playerName: string;
  assists: number;
  cleansheetsAny: number;
  cleansheetsDef: number;
  cleansheetsGk: number;
  goals: number;
  goalsConceded: number;
  losses: number;
  mom: boolean;
  namespace: number;
  passAttempts: number;
  passesMade: number;
  passAccuracy: number;
  position: string;
  rating: number;
  realtimeGame: string;
  realtimeIdle: string;
  redCards: number;
  saves: number;
  score: number;
  shots: number;
  tackleAttempts: number;
  tacklesMade: number;
  vproAttr: string;
  vproHackReason: string;
  wins: number;
  statistics?: PlayerMatchStatsDto;
}

export default function PlayerStats() {
  const { matchId, playerId } = useParams<PlayerStatsParams>();
  const [data, setData] = useState<MatchPlayerStatsDto | null>(null);

  useEffect(() => {
    if (matchId && playerId) {
      api
        .get(`/statistics/player/${matchId}/${playerId}`)
        .then((res) => {
          console.log('DATA COMPLETA:', res.data);
          setData(res.data);
        })
        .catch((err) => {
          console.error('Erro na API:', err);
          setData(null);
        });
    }
  }, [matchId, playerId]);

  if (!data) return <p className="p-4">Carregando...</p>;

const renderProgressBar = (value: number, label: string) => {
  const percentage = Math.min(Math.max(value, 0), 100);

  let barColor = 'bg-green-500';
  if (value < 40) {
    barColor = 'bg-red-500';
  } else if (value < 70) {
    barColor = 'bg-yellow-400';
  }

  return (
    <div className="mb-3">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <div className="w-full bg-gray-300 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full ${barColor}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <span className="ml-2 text-sm font-semibold text-gray-700 w-8 text-right">{value}</span>
      </div>
    </div>
  );
};

  return (
    <div className="p-4 max-w-5xl mx-auto bg-white shadow-lg rounded-lg">
      <div className="flex items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-800">{data.playerName}</h1>
          <p className="text-gray-600">{data.position}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">Estatísticas da Partida</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-sm text-gray-700">
          <li><strong>Gols:</strong> {data.goals}</li>
          <li><strong>Assistências:</strong> {data.assists}</li>
          <li><strong>Chutes:</strong> {data.shots}</li>
          <li><strong>Passes Certos:</strong> {data.passesMade}</li>
          <li><strong>Passes Tentados:</strong> {data.passAttempts}</li>
          <li><strong>Precisão de Passe:</strong> {data.passAccuracy.toFixed(1)}%</li>
          <li><strong>Desarmes Certos:</strong> {data.tacklesMade}</li>
          <li><strong>Desarmes Tentados:</strong> {data.tackleAttempts}</li>
          <li><strong>Defesas:</strong> {data.saves}</li>
          <li><strong>Gols Sofridos:</strong> {data.goalsConceded}</li>
          <li><strong>Cartões Vermelhos:</strong> {data.redCards}</li>
          <li><strong>Nota:</strong> {data.rating.toFixed(2)}</li>
          <li><strong>Melhor em Campo:</strong> {data.mom ? 'Sim' : 'Não'}</li>
          <li><strong>Vitórias:</strong> {data.wins}</li>
          <li><strong>Derrotas:</strong> {data.losses}</li>
          <li><strong>Score:</strong> {data.score}</li>
          <li><strong>Namespace:</strong> {data.namespace}</li>
          <li><strong>VPro Attr:</strong> {data.vproAttr}</li>
          <li><strong>Hack Reason:</strong> {data.vproHackReason}</li>
        </ul>
      </div>

      {data.statistics && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Atributos Técnicos</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-sm text-gray-700">
            {Object.entries(data.statistics).map(([key, value]) => {
              // Renderizar as barras de progresso apenas para valores numéricos
              if (typeof value === 'number') {
                return (
                  <li key={key} className="col-span-1">
                    {renderProgressBar(value, key.replace(/([A-Z])/g, ' $1').toUpperCase())}
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
