import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [matches, setMatches] = useState<any[]>([]);

  // Função para obter a URL da logo com base no crestAssetId
  const getLogoUrl = (crestAssetId: string) => {
    if (crestAssetId) {
      return `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${crestAssetId}.png`;
    }
    // Imagem default caso o crestAssetId não exista
    return 'https://via.placeholder.com/256?text=No+Logo';
  };

  // Função para converter número decimal para hexadecimal
  const convertToHex = (decimalColor: string | number) => {
    // Se a entrada for string, primeiro convertemos para número
    let decimalValue = typeof decimalColor === "string" ? parseInt(decimalColor, 10) : decimalColor;

    // Converte o número decimal para hexadecimal
    return `#${decimalValue.toString(16).padStart(6, '0').toUpperCase()}`;
  };

  // Função para renderizar as cores dos kits
  const renderKitColors = (kitColors: (string | number)[]) => (
    <div className="flex space-x-1 mb-2">
      {kitColors.filter(color => color !== undefined && color !== null).map((color, index) => {
        let hexColor = null;

        // Se a cor for número (decimal), converte para hexadecimal
        if (typeof color === "number") {
          hexColor = convertToHex(color);
        } 
        // Se a cor for uma string hexadecimal válida (6 caracteres)
        else if (typeof color === "string" && color.length === 6) {
          hexColor = `#${color}`;
        } 
        // Se a cor for uma string hexadecimal com o símbolo '#', apenas a utilizamos diretamente
        else if (typeof color === "string" && color.startsWith('#') && color.length === 7) {
          hexColor = color; 
        } else {
          hexColor = convertToHex(color);
        }

        if (hexColor && hexColor.length === 7) {
          return (
            <div 
              key={index} 
              style={{ backgroundColor: hexColor }} 
              className="w-6 h-6 rounded"
            />
          );
        } else {
          console.log(`Cor inválida para o time: ${color}`);
          return null;
        }
      })}
    </div>
  );

    useEffect(() => {
        fetch("https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/matches/results")
            .then(res => res.json())
            .then(data => setMatches(data))
            .catch(err => console.error("Erro:", err));
    }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Resultados das Partidas</h1>
      <div className="grid gap-4">
        {matches.map(m => (
          <Link
            key={m.matchId}
            to={`/match/${m.matchId}`}
            className="block bg-white shadow rounded p-4 hover:bg-blue-50"
          >
            <div className="text-center text-sm text-gray-500 mb-4">{new Date(m.timestamp).toLocaleString()}</div>
            
            <div className="flex items-center justify-center space-x-4">
              {/* Time A */}
              <div className="flex flex-col items-center">
                <img 
                  src={getLogoUrl(m.clubADetails?.crestAssetId)} 
                  alt={`${m.clubAName} Logo`} 
                  className="w-12 h-12 rounded-full mb-2"
                />
                <div>{m.clubAName}</div>
                {/* Exibe as cores do kit (Principal, Reserva, Terceiro) */}
                {/* {renderKitColors([m.clubADetails?.kitColor1, m.clubADetails?.kitColor2, m.clubADetails?.kitColor3, m.clubADetails?.kitColor4])} */}

                {/* Exibe as cores do kit A e kit Thrd (Principal e Terceiro) */}
                {/* {renderKitColors([m.clubADetails?.kitAColor1, m.clubADetails?.kitAColor2, m.clubADetails?.kitAColor3, m.clubADetails?.kitAColor4])} */}
                {/* {renderKitColors([m.clubADetails?.kitThrdColor1, m.clubADetails?.kitThrdColor2, m.clubADetails?.kitThrdColor3, m.clubADetails?.kitThrdColor4])} */}
              </div>

              {/* Resultado da partida no meio (formato: clubeA.ClubGoals x clubeB.ClubGoals) */}
              <div className="font-semibold text-xl mx-4">
                {m.clubAGoals} x {m.clubBGoals}
              </div>

              {/* Time B */}
              <div className="flex flex-col items-center">
                <img 
                  src={getLogoUrl(m.clubBDetails?.crestAssetId)} 
                  alt={`${m.clubBName} Logo`} 
                  className="w-12 h-12 rounded-full mb-2"
                />
                <div>{m.clubBName}</div>
                {/* Exibe as cores do kit (Principal, Reserva, Terceiro)
                {renderKitColors([m.clubBDetails?.kitColor1, m.clubBDetails?.kitColor2, m.clubBDetails?.kitColor3, m.clubBDetails?.kitColor4])}

                {/* Exibe as cores do kit A e kit Thrd (Principal e Terceiro) */}
                {/* {renderKitColors([m.clubBDetails?.kitAColor1, m.clubBDetails?.kitAColor2, m.clubBDetails?.kitAColor3, m.clubBDetails?.kitAColor4])} */}
                {/* {renderKitColors([m.clubBDetails?.kitThrdColor1, m.clubBDetails?.kitThrdColor2, m.clubBDetails?.kitThrdColor3, m.clubBDetails?.kitThrdColor4])} */}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
