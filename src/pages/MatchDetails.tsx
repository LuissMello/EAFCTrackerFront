import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../services/api.ts';
import { Link } from 'react-router-dom';

// Configuração do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Função para gerar uma cor única para cada jogador
const generateRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

export default function MatchDetails() {
  const { matchId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState('totalGoals'); // Estatística selecionada para o gráfico de jogadores
  const [playerColors, setPlayerColors] = useState<Map<number, string>>(new Map()); // Armazenar cores dos jogadores

  useEffect(() => {
    if (!matchId) return;

    api.get(`/statistics/${matchId}`)
      .then(res => {
        setData(res.data);

        // Gerando uma cor única para cada jogador e armazenando no estado
        const colors = new Map<number, string>();
        res.data.players.forEach((player: any) => {
          colors.set(player.playerId, generateRandomColor()); // Gerar e armazenar cor
        });
        setPlayerColors(colors); // Atualizar as cores no estado
      })
      .catch(err => {
        console.error('Erro ao buscar estatísticas:', err);
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <p className="p-4">Carregando...</p>;
  if (!data) return <p className="p-4 text-red-500">Dados indisponíveis.</p>;

  const { players, clubs } = data;

  // Definindo as estatísticas que podemos comparar para jogadores e clubes
  const comparisonStats = [
    { label: 'Gols', value: 'totalGoals' },
    { label: 'Assistências', value: 'totalAssists' },
    { label: 'Chutes', value: 'totalShots' },
    { label: 'Precisão de Chutes (%)', value: 'goalAccuracyPercent' },
    { label: 'Passes Certos', value: 'totalPassesMade' },
    { label: 'Passes Tentados', value: 'totalPassAttempts' },
    { label: 'Precisão de Passe (%)', value: 'passAccuracyPercent' },
    { label: 'Desarmes Certos', value: 'totalTacklesMade' },
    { label: 'Desarmes Tentados', value: 'totalTackleAttempts' },
    { label: 'Precisão de Desarmes (%)', value: 'tackleSuccessPercent' },
    { label: 'Nota Média', value: 'avgRating' },
  ];

  // Função para formatar os valores das estatísticas
  const formatValue = (value: any) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value.toFixed(1);
      } else {
        return value;
      }
    }
    return '–'; // Se o valor for undefined ou null
  };

  // Função para formatar porcentagens (caso necessário)
  const formatPercent = (value: number) => (value !== undefined && value !== null ? `${value.toFixed(1)}%` : '–');

  // Função para gerar a URL da logo do clube
  const getClubLogoUrl = (crestAssetId: string) => {
    return crestAssetId
      ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${crestAssetId}.png`
      : 'https://via.placeholder.com/256?text=No+Logo';
  };

  // Gerando os dados para o gráfico de jogadores
  const playerComparisonData = players.map((player: any) => ({
    name: player.playerName,
    value: player[selectedStat], // Seleciona a estatística correta
    color: playerColors.get(player.playerId) || '#000000', // Usando a cor gerada para cada jogador
  }));

  const labels = playerComparisonData.map(player => player.name);
  const values = playerComparisonData.map(player => player.value);
  const colors = playerComparisonData.map(player => player.color);

  // Dados para o gráfico do Chart.js
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Estatísticas dos Jogadores',
        data: values,
        backgroundColor: colors, // Cor única para cada barra
        borderColor: colors,
        borderWidth: 1,
      },
    ],
  };

  // Configuração do gráfico (com layout horizontal)
  const options = {
    responsive: true,
    indexAxis: 'y', // Isso faz com que o gráfico seja exibido na horizontal
    plugins: {
      title: {
        display: true,
        text: 'Comparativo de Jogadores',
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: any) {
            return `${tooltipItem.raw.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
    },
    // Diminuindo a largura das barras
    elements: {
      bar: {
        borderWidth: 1,
        barThickness: 1, // Reduzindo a largura das barras
      },
    },
  };

  // Comparativo de Clubes para o gráfico
  const clubComparisonData = comparisonStats.map(({ label, value }) => ({
    label,
    value,
  })).filter(stat => stat.value === selectedStat).map(({ label, value }) => ({
    name: label,
    [clubs[0].clubName]: clubs[0][value],
    [clubs[1].clubName]: clubs[1][value],
  }));

  // Dados para o gráfico de comparação entre clubes
  const clubChartData = {
    labels: clubComparisonData.map(data => data.name),
    datasets: [
      {
        label: clubs[0].clubName,
        data: clubComparisonData.map(data => data[clubs[0].clubName]),
        backgroundColor: '#4F46E5', // Cor do primeiro time
        borderColor: '#4F46E5',
        borderWidth: 1,
      },
      {
        label: clubs[1].clubName,
        data: clubComparisonData.map(data => data[clubs[1].clubName]),
        backgroundColor: '#10B981', // Cor do segundo time
        borderColor: '#10B981',
        borderWidth: 1,
      },
    ],
  };

  const clubChartOptions = {
    responsive: true,
    indexAxis: 'y', // Isso faz com que o gráfico seja exibido na horizontal
    plugins: {
      title: {
        display: true,
        text: 'Comparativo entre Clubes',
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
    },
    // Diminuindo a largura das barras
    elements: {
      bar: {
        borderWidth: 2,
        barThickness: 10, // Reduzindo a largura das barras
      },
    },
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold">Detalhes da Partida</h1>

      {/* Comparativo dos Clubes */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Comparativo dos Clubes</h2>
        <div className="flex justify-between mb-4">
          {/* Exibir nome e logo do clube A */}
          <div className="flex items-center">
            <img
              src={getClubLogoUrl(clubs[0]?.clubCrestAssetId)} // Gera a URL do logo do clube A
              alt={`${clubs[0].clubName} Logo`}
              className="w-8 h-8 rounded-full mr-2"
            />
            <div className="font-semibold">{clubs[0].clubName}</div>
          </div>

          {/* Exibir nome e logo do clube B */}
          <div className="flex items-center">
            <img
              src={getClubLogoUrl(clubs[1]?.clubCrestAssetId)} // Gera a URL do logo do clube B
              alt={`${clubs[1].clubName} Logo`}
              className="w-8 h-8 rounded-full mr-2"
            />
            <div className="font-semibold">{clubs[1].clubName}</div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full table-auto text-sm border text-center">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-center">{clubs[0].clubName}</th>
                <th className="p-2 text-center">Estatística</th>
                <th className="p-2 text-center">{clubs[1].clubName}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonStats.map(({ label, value }) => (
                <tr key={value} className="border-t">
                  <td className="p-2">{formatValue(clubs[0][value])}</td>
                  <td className="p-2 font-medium">{label}</td>
                  <td className="p-2">{formatValue(clubs[1][value])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
{/* Gráfico Comparativo entre Clubes */}
<div className="bg-white shadow rounded p-4" style={{ width: '500px', height: '200px' }}>
  <h2 className="text-xl font-semibold mb-4">Gráfico Comparativo entre Clubes</h2>
  <Bar
    data={clubChartData}
    options={clubChartOptions}
  />
</div>

      {/* Gráfico Comparativo dos Jogadores */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Gráfico Comparativo dos Jogadores</h2>
        <div className="mb-4">
          <label htmlFor="stat-select-players" className="mr-2 font-medium">Selecione a Estatística para Jogadores:</label>
          <select
            id="stat-select-players"
            value={selectedStat}
            onChange={(e) => setSelectedStat(e.target.value)}
            className="border rounded p-1"
          >
            {comparisonStats.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <Bar
          data={chartData}
          options={options}
          height={200} // Ajusta a altura do gráfico
          width={350} // Ajusta a largura do gráfico
        />
      </div>

      {/* Tabela de Jogadores */}
      {clubs.map((club: any) => (
        <div key={club.clubName} className="bg-white shadow rounded p-4">
          <h2 className="text-xl font-semibold mb-2">{club.clubName} - Jogadores</h2>
          <div className="overflow-auto">
            <table className="w-full table-auto text-sm border text-center">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2">Jogador</th>
                  <th className="p-2">Gols</th>
                  <th className="p-2">Assistências</th>
                  <th className="p-2">Chutes</th>
                  <th className="p-2">Chutes %</th>
                  <th className="p-2">Passes</th>
                  <th className="p-2">Tentativas</th>
                  <th className="p-2">Passes %</th>
                  <th className="p-2">Desarmes</th>
                  <th className="p-2">Tentativas</th>
                  <th className="p-2">Desarmes %</th>
                  <th className="p-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {players.filter((p: any) => p.clubId === club.clubId).map((p: any) => (
                  <tr key={p.playerId} className="border-t">
                    <td className="p-2 text-left text-blue-600 underline cursor-pointer">
                      <Link to={`/statistics/player/${matchId}/${p.playerId}`}>
                        {p.playerName}
                      </Link>
                    </td>
                    <td className="p-2">{p.totalGoals}</td>
                    <td className="p-2">{p.totalAssists}</td>
                    <td className="p-2">{p.totalShots}</td>
                    <td className="p-2">{formatPercent(p.goalAccuracyPercent)}</td>
                    <td className="p-2">{p.totalPassesMade}</td>
                    <td className="p-2">{p.totalPassAttempts}</td>
                    <td className="p-2">{formatPercent(p.passAccuracyPercent)}</td>
                    <td className="p-2">{p.totalTacklesMade}</td>
                    <td className="p-2">{p.totalTackleAttempts}</td>
                    <td className="p-2">{formatPercent(p.tackleSuccessPercent)}</td>
                    <td className="p-2">{(p.avgRating / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
