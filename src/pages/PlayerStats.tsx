// src/pages/PlayerStats.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api.ts";
import { classifyStat, calculateShotToGoalConversion } from "../utils/statClassifier.ts";
import { StatWithQuality } from "../components/StatQualityIndicator.tsx";
import { Tooltip } from "../components/Tooltip.tsx";

/**********************************
 * Tipos (front)
 **********************************/
interface RouteParams {
  matchId?: string;
  playerId?: string;
}

type PlayerMatchStats = {
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
};

type MatchPlayerStats = {
  id: number;
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
  passAccuracy: number; // %
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
  statistics: PlayerMatchStats | null;
};

type ClubAggregateRow = {
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
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;

  avgRating: number;

  passAccuracyPercent: number;
  tackleSuccessPercent: number;
  goalAccuracyPercent: number;
  winPercent: number;
};

type ClubAttrSnapshot = {
  playerId: number;
  playerName: string;
  stats: PlayerMatchStats | null;
};

/**********************************
 * Helpers
 **********************************/
function clamp01to100(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
const fmtPct = (n: number | undefined | null) => (Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : "0.0%");
const fmtNum = (n: number | undefined | null) => (Number.isFinite(Number(n)) ? String(Number(n)) : "0");

/** tenta ler tanto camelCase quanto PascalCase */
function pick<T = any>(obj: any, camel: string, pascal: string): T {
  if (!obj) return undefined as any;
  if (camel in obj) return obj[camel];
  if (pascal in obj) return obj[pascal];
  return undefined as any;
}

const ATTR_LABELS: Record<keyof PlayerMatchStats, string> = {
  aceleracao: "ACELERAÇÃO",
  pique: "PIQUE",
  finalizacao: "FINALIZAÇÃO",
  falta: "FALTA",
  cabeceio: "CABECEIO",
  forcaDoChute: "FORÇA DO CHUTE",
  chuteLonge: "CHUTE LONGE",
  voleio: "VOLEIO",
  penalti: "PÊNALTI",
  visao: "VISÃO",
  cruzamento: "CRUZAMENTO",
  lancamento: "LANÇAMENTO",
  passeCurto: "PASSE CURTO",
  curva: "CURVA",
  agilidade: "AGILIDADE",
  equilibrio: "EQUILÍBRIO",
  posAtaqueInutil: "POSIÇÃO ATAQUE",
  controleBola: "CONTROLE DE BOLA",
  conducao: "CONDUÇÃO",
  interceptacaos: "INTERCEPTAÇÕES",
  nocaoDefensiva: "NOÇÃO DEFENSIVA",
  divididaEmPe: "DIVIDIDA EM PÉ",
  carrinho: "CARRINHO",
  impulsao: "IMPULSÃO",
  folego: "FÔLEGO",
  forca: "FORÇA",
  reacao: "REAÇÃO",
  combatividade: "COMBATIVIDADE",
  frieza: "FRIEZA",
  elasticidadeGL: "ELASTICIDADE (GL)",
  manejoGL: "MANEJO (GL)",
  chuteGL: "CHUTE (GL)",
  reflexosGL: "REFLEXOS (GL)",
  posGL: "POSICIONAMENTO (GL)",
};

const GROUPS: Array<{ name: string; keys: (keyof PlayerMatchStats)[]; onlyGK?: boolean }> = [
  { name: "Ritmo", keys: ["aceleracao", "pique"] },
  {
    name: "Finalização",
    keys: ["finalizacao", "cabeceio", "forcaDoChute", "chuteLonge", "voleio", "penalti", "frieza"],
  },
  { name: "Passe", keys: ["visao", "cruzamento", "lancamento", "passeCurto", "curva"] },
  { name: "Drible", keys: ["agilidade", "equilibrio", "posAtaqueInutil", "controleBola", "conducao", "reacao"] },
  { name: "Defesa", keys: ["interceptacaos", "nocaoDefensiva", "divididaEmPe", "carrinho", "combatividade"] },
  { name: "Físico", keys: ["impulsao", "folego", "forca"] },
  { name: "Goleiro", keys: ["elasticidadeGL", "manejoGL", "chuteGL", "reflexosGL", "posGL"], onlyGK: true },
];

/**********************************
 * UI Atômicos
 **********************************/
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border p-4 ${className}`}>{children}</div>
);

function StatTile({
  label,
  value,
  hint,
  statType,
  rawValue,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  statType?: string;
  rawValue?: number;
}) {
  const quality = statType && rawValue !== undefined ? classifyStat(statType, rawValue) : null;

  const tileContent = (
    <div className="rounded-2xl border bg-white p-3 shadow-sm hover:shadow transition-shadow">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">
        {quality ? <StatWithQuality value={value} quality={quality} /> : value}
      </div>
    </div>
  );
  
  return hint ? (
    <Tooltip content={hint}>{tileContent}</Tooltip>
  ) : (
    tileContent
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = clamp01to100(value);
  const color = pct < 40 ? "bg-rose-500" : pct < 70 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="mb-3" aria-label={`${label}: ${Math.round(pct)}`}>
      <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1 tracking-wide">{label}</label>
      <div className="relative flex items-center">
        <div className="w-full bg-gray-200/70 rounded-full h-2.5 overflow-hidden">
          <div className={`h-2.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <span className="ml-2 text-xs sm:text-sm font-semibold text-gray-700 w-10 text-right">{Math.round(pct)}</span>
      </div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-xl rounded-2xl border bg-white p-6 text-center shadow-sm">
      <div className="text-red-600 font-semibold">Erro ao carregar</div>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
      >
        Tentar novamente
      </button>
    </div>
  );
}

/**********************************
 * Mapeadores resilientes (camel/Pascal)
 **********************************/
function mapAttr(be?: any | null): PlayerMatchStats | null {
  if (!be) return null;
  return {
    aceleracao: pick<number>(be, "aceleracao", "Aceleracao"),
    pique: pick(be, "pique", "Pique"),
    finalizacao: pick(be, "finalizacao", "Finalizacao"),
    falta: pick(be, "falta", "Falta"),
    cabeceio: pick(be, "cabeceio", "Cabeceio"),
    forcaDoChute: pick(be, "forcaDoChute", "ForcaDoChute"),
    chuteLonge: pick(be, "chuteLonge", "ChuteLonge"),
    voleio: pick(be, "voleio", "Voleio"),
    penalti: pick(be, "penalti", "Penalti"),
    visao: pick(be, "visao", "Visao"),
    cruzamento: pick(be, "cruzamento", "Cruzamento"),
    lancamento: pick(be, "lancamento", "Lancamento"),
    passeCurto: pick(be, "passeCurto", "PasseCurto"),
    curva: pick(be, "curva", "Curva"),
    agilidade: pick(be, "agilidade", "Agilidade"),
    equilibrio: pick(be, "equilibrio", "Equilibrio"),
    posAtaqueInutil: pick(be, "posAtaqueInutil", "PosAtaqueInutil"),
    controleBola: pick(be, "controleBola", "ControleBola"),
    conducao: pick(be, "conducao", "Conducao"),
    interceptacaos: pick(be, "interceptacaos", "Interceptacaos"),
    nocaoDefensiva: pick(be, "nocaoDefensiva", "NocaoDefensiva"),
    divididaEmPe: pick(be, "divididaEmPe", "DivididaEmPe"),
    carrinho: pick(be, "carrinho", "Carrinho"),
    impulsao: pick(be, "impulsao", "Impulsao"),
    folego: pick(be, "folego", "Folego"),
    forca: pick(be, "forca", "Forca"),
    reacao: pick(be, "reacao", "Reacao"),
    combatividade: pick(be, "combatividade", "Combatividade"),
    frieza: pick(be, "frieza", "Frieza"),
    elasticidadeGL: pick(be, "elasticidadeGL", "ElasticidadeGL"),
    manejoGL: pick(be, "manejoGL", "ManejoGL"),
    chuteGL: pick(be, "chuteGL", "ChuteGL"),
    reflexosGL: pick(be, "reflexosGL", "ReflexosGL"),
    posGL: pick(be, "posGL", "PosGL"),
  };
}

function mapPlayer(be: any): MatchPlayerStats {
  const statistics = pick<any>(be, "statistics", "Statistics");
  return {
    playerId: pick<number>(be, "playerId", "PlayerId"),
    id: pick<number>(be, "id", "Id"),
    playerName: pick<string>(be, "playerName", "PlayerName"),
    assists: pick(be, "assists", "Assists"),
    cleansheetsAny: pick(be, "cleansheetsAny", "CleansheetsAny"),
    cleansheetsDef: pick(be, "cleansheetsDef", "CleansheetsDef"),
    cleansheetsGk: pick(be, "cleansheetsGk", "CleansheetsGk"),
    goals: pick(be, "goals", "Goals"),
    goalsConceded: pick(be, "goalsConceded", "GoalsConceded"),
    losses: pick(be, "losses", "Losses"),
    mom: pick(be, "mom", "Mom"),
    namespace: pick(be, "namespace", "Namespace"),
    passAttempts: pick(be, "passAttempts", "PassAttempts"),
    passesMade: pick(be, "passesMade", "PassesMade"),
    passAccuracy: pick(be, "passAccuracy", "PassAccuracy"),
    position: pick(be, "position", "Position"),
    rating: pick(be, "rating", "Rating"),
    realtimeGame: pick(be, "realtimeGame", "RealtimeGame"),
    realtimeIdle: pick(be, "realtimeIdle", "RealtimeIdle"),
    redCards: pick(be, "redCards", "RedCards"),
    saves: pick(be, "saves", "Saves"),
    score: pick(be, "score", "Score"),
    shots: pick(be, "shots", "Shots"),
    tackleAttempts: pick(be, "tackleAttempts", "TackleAttempts"),
    tacklesMade: pick(be, "tacklesMade", "TacklesMade"),
    vproAttr: pick(be, "vproAttr", "VproAttr"),
    vproHackReason: pick(be, "vproHackReason", "VproHackReason"),
    wins: pick(be, "wins", "Wins"),
    statistics: mapAttr(statistics),
  };
}

/**********************************
 * Página
 **********************************/
export default function PlayerStatsPage() {
  const { matchId, playerId } = useParams<RouteParams>();

  // estado principal do jogador na partida
  const [player, setPlayer] = useState<MatchPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // descobrir clubId do jogador naquele match
  const [clubId, setClubId] = useState<number | null>(null);

  // painéis
  const [nMatchesPerf, setNMatchesPerf] = useState(10); // continua configurável
  const [perfCollapsed, setPerfCollapsed] = useState(true); // inicia minimizado
  const [attrCollapsed, setAttrCollapsed] = useState(true); // inicia minimizado
  const [perfView, setPerfView] = useState<"Top 10" | "Todos">("Top 10");

  // dados comparativos
  const [teamRows, setTeamRows] = useState<ClubAggregateRow[]>([]);
  const [teamAttrs, setTeamAttrs] = useState<ClubAttrSnapshot[]>([]); // snapshots do ÚLTIMO jogo

  // alvo de comparação de atributos: 'avg' (média do time) ou playerId numérico
  const [attrCompareTarget, setAttrCompareTarget] = useState<"avg" | number>("avg");

  /***************
   * Fetch: jogador naquela partida
   ***************/
  useEffect(() => {
    if (!matchId || !playerId) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // jogador naquela partida
        const { data } = await api.get(`/api/matches/${matchId}/players/${playerId}/statistics`, {
          signal: controller.signal,
        });
        setPlayer(mapPlayer(data));

        // descobrir clubId a partir do match (olhando players)
        const { data: matchData } = await api.get(`/api/matches/${matchId}`, { signal: controller.signal });
        const playersAny: any[] = matchData?.players ?? matchData?.Players ?? [];
        const found = playersAny.find((x: any) => String(pick(x, "id", "Id")) === String(playerId));
        if (found) {
          const cid = pick<number>(found, "clubId", "ClubId");
          setClubId(Number(cid));
        }
      } catch (err: any) {
        if (err?.name !== "CanceledError" && err?.message !== "canceled") {
          setError(err?.message ?? "Erro ao carregar dados do jogador");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [matchId, playerId]);

  /***************
   * Fetch: agregados (últimas N) quando já temos clubId
   ***************/
  useEffect(() => {
    if (!clubId) return;
    const controller = new AbortController();

    (async () => {
      try {
        // desempenho (players aggregate) — N partidas
        const { data: agg } = await api.get(`/api/clubs/${clubId}/players/aggregate?count=${nMatchesPerf}`, {
          signal: controller.signal,
        });
        const arr: any[] = Array.isArray(agg) ? agg : [];
        const rows = arr.map((r) => ({
          playerId: Number(pick(r, "playerId", "PlayerId")),
          playerName: String(pick(r, "playerName", "PlayerName") ?? ""),
          clubId: Number(pick(r, "clubId", "ClubId") ?? 0),
          matchesPlayed: Number(pick(r, "matchesPlayed", "MatchesPlayed") ?? 0),
          totalGoals: Number(pick(r, "totalGoals", "TotalGoals") ?? 0),
          totalAssists: Number(pick(r, "totalAssists", "TotalAssists") ?? 0),
          totalShots: Number(pick(r, "totalShots", "TotalShots") ?? 0),
          totalPassesMade: Number(pick(r, "totalPassesMade", "TotalPassesMade") ?? 0),
          totalPassAttempts: Number(pick(r, "totalPassAttempts", "TotalPassAttempts") ?? 0),
          totalTacklesMade: Number(pick(r, "totalTacklesMade", "TotalTacklesMade") ?? 0),
          totalTackleAttempts: Number(pick(r, "totalTackleAttempts", "TotalTackleAttempts") ?? 0),
          totalCleanSheets: Number(pick(r, "totalCleanSheets", "TotalCleanSheets") ?? 0),
          totalRedCards: Number(pick(r, "totalRedCards", "TotalRedCards") ?? 0),
          totalSaves: Number(pick(r, "totalSaves", "TotalSaves") ?? 0),
          avgRating: Number(pick(r, "avgRating", "AvgRating") ?? 0),
          passAccuracyPercent: Number(pick(r, "passAccuracyPercent", "PassAccuracyPercent") ?? 0),
          tackleSuccessPercent: Number(pick(r, "tackleSuccessPercent", "TackleSuccessPercent") ?? 0),
          goalAccuracyPercent: Number(pick(r, "goalAccuracyPercent", "GoalAccuracyPercent") ?? 0),
          winPercent: Number(pick(r, "winPercent", "WinPercent") ?? 0),
        })) as ClubAggregateRow[];
        setTeamRows(rows);
      } catch {
        setTeamRows([]);
      }
    })();

    return () => controller.abort();
  }, [clubId, nMatchesPerf]);

  /***************
   * Fetch: atributos do ÚLTIMO jogo do clube (count=1)
   ***************/
  useEffect(() => {
    if (!clubId) return;
    const controller = new AbortController();

    (async () => {
      try {
        const { data } = await api.get(`/api/clubs/${clubId}/players/attributes?count=1`, {
          signal: controller.signal,
        });
        const arr: any[] = Array.isArray(data) ? data : [];
        setTeamAttrs(
          arr.map((row: any) => ({
            playerId: Number(pick(row, "playerId", "PlayerId")),
            playerName: String(pick(row, "playerName", "PlayerName") ?? ""),
            stats: mapAttr(pick(row, "statistics", "Statistics")),
          })) as ClubAttrSnapshot[]
        );

        // se o alvo de comparação for um jogador que não veio nesse último jogo, volta para média
        setAttrCompareTarget((prev) => {
          if (prev === "avg") return prev;
          const exists = arr.some((r: any) => String(pick(r, "playerId", "PlayerId")) === String(prev));
          return exists ? prev : "avg";
        });
      } catch {
        setTeamAttrs([]);
        setAttrCompareTarget("avg");
      }
    })();

    return () => controller.abort();
  }, [clubId]);

  const isGK = useMemo(() => {
    const pos = (player?.position || "").toLowerCase();
    return pos.includes("gk") || pos.includes("gol") || pos.includes("gl") || pos.includes("goalkeeper");
  }, [player?.position]);

  const computedPassAcc = useMemo(() => {
    if (!player) return 0;
    if (Number.isFinite(player.passAccuracy)) return player.passAccuracy;
    if (player.passAttempts > 0) return (player.passesMade / player.passAttempts) * 100;
    return 0;
  }, [player]);

  const groupAverages = useMemo(() => {
    const atts = player?.statistics;
    if (!atts) return [] as { group: string; value: number }[];
    return GROUPS.filter((g) => (g.onlyGK ? isGK : true)).map((g) => {
      const vals = g.keys.map((k) => Number((atts as any)[k])).filter((v) => Number.isFinite(v));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { group: g.name, value: Math.round(avg) };
    });
  }, [player?.statistics, isGK]);

  // jogador vs time (ultimas N) — desempenho
  const perfComparison = useMemo(() => {
    if (!player || teamRows.length === 0) return null;
    const me = teamRows.find((r) => String(r.playerId) === String(player.playerId));
    const base = teamRows;
    const avg = (sel: (r: ClubAggregateRow) => number) => {
      const vals = base.map(sel).filter((v) => Number.isFinite(v));
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return {
      me,
      teamAvg: {
        goals: avg((r) => r.totalGoals),
        assists: avg((r) => r.totalAssists),
        shots: avg((r) => r.totalShots),
        passAcc: avg((r) => r.passAccuracyPercent),
        tackles: avg((r) => r.totalTacklesMade),
        tackAcc: avg((r) => r.tackleSuccessPercent),
        rating: avg((r) => r.avgRating),
        win: avg((r) => r.winPercent),
      },
      sorted: [...teamRows]
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
        .slice(0, perfView === "Top 10" ? 10 : teamRows.length),
    };
  }, [player, teamRows, perfView]);

  // atributos: comparação do SEU snapshot da partida vs alvo (média do time OU jogador específico do último jogo)
  const attrComparison = useMemo(() => {
    const myStats = player?.statistics;
    if (!myStats || teamAttrs.length === 0) return null;

    const keys = Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[];

    // baseline: média do time OU stats de um jogador específico
    let label = "Média do Time";
    let baseline: Partial<Record<keyof PlayerMatchStats, number>> = {};

    if (attrCompareTarget === "avg") {
      const all: PlayerMatchStats[] = teamAttrs.map((t) => t.stats).filter((x): x is PlayerMatchStats => !!x);
      keys.forEach((k) => {
        const vals = all.map((a) => Number((a as any)[k])).filter((v) => Number.isFinite(v));
        baseline[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
    } else {
      const peer = teamAttrs.find((t) => String(t.playerId) === String(attrCompareTarget));
      label = peer?.playerName || "Jogador";
      const s = peer?.stats;
      keys.forEach((k) => {
        baseline[k] = Number((s as any)?.[k]) || 0;
      });
    }

    const myPairs = keys.map((k) => ({
      key: k,
      mine: Number((myStats as any)[k]) || 0,
      peer: baseline[k] || 0,
    }));

    return {
      label,
      list: myPairs,
      topMine: myPairs
        .filter((x) => x.mine > 0)
        .sort((a, b) => b.mine - a.mine)
        .slice(0, 8),
    };
  }, [player?.statistics, teamAttrs, attrCompareTarget]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  /***************
   * Render
   ***************/
  if (loading) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-24 w-full mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!player) return <div className="p-4">Dados indisponíveis.</div>;

  const GK = (player?.position || "").toLowerCase().includes("gk");
  const passAcc = computedPassAcc;

  // Calculate additional stats for quality indicators
  const shotToGoalConv = calculateShotToGoalConversion(player.goals, player.shots);
  const tackleSuccessPct = player.tackleAttempts > 0 ? (player.tacklesMade / player.tackleAttempts) * 100 : 0;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 flex items-center gap-2">
            {player.playerName}
            {player.mom && (
              <Tooltip content="Melhor em Campo">
                <span className="ml-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-semibold text-yellow-900">
                  MOM
                </span>
              </Tooltip>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a href={shareUrl} className="text-sm text-blue-700 hover:underline">
            Compartilhar
          </a>
          <Link to={`/match/${matchId}`} className="text-blue-700 hover:underline text-sm">
            ← Voltar para a partida
          </Link>
        </div>
      </div>

      {/* RESUMO DA PARTIDA */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Resumo da Partida</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <StatTile label="Gols" value={fmtNum(player.goals)} />
          <StatTile label="Assistências" value={fmtNum(player.assists)} />
          <StatTile label="Chutes" value={fmtNum(player.shots)} />
          <StatTile label="Passes certos" value={fmtNum(player.passesMade)} />
          <StatTile label="Passes tentados" value={fmtNum(player.passAttempts)} />
          <StatTile label="Precisão de passe" value={fmtPct(passAcc)} statType="passCompletion" rawValue={passAcc} />
          <StatTile label="Desarmes certos" value={fmtNum(player.tacklesMade)} />
          <StatTile label="Desarmes tentados" value={fmtNum(player.tackleAttempts)} />
          {GK && <StatTile label="Defesas" value={fmtNum(player.saves)} />}
          {GK && <StatTile label="Gols sofridos" value={fmtNum(player.goalsConceded)} />}
          <StatTile label="Nota" value={Number.isFinite(player.rating) ? Number(player.rating).toFixed(2) : "0.00"} />
          <StatTile label="Cartões vermelhos" value={fmtNum(player.redCards)} />
          <StatTile label="Score" value={fmtNum(player.score)} />
          <StatTile
            label="Conversão de chutes"
            value={fmtPct(shotToGoalConv)}
            statType="shotToGoalConversion"
            rawValue={shotToGoalConv}
          />
          <StatTile
            label="Sucesso nos desarmes"
            value={fmtPct(tackleSuccessPct)}
            statType="tackleDuelWin"
            rawValue={tackleSuccessPct}
          />
        </div>

        {/* Radar + Highlights de atributos */}
        {groupAverages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <Card>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Médias por Grupo</h3>
              <RadarSVG data={groupAverages} />
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Pontos fortes</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(player.statistics ?? {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between rounded-xl border p-2">
                      <span className="text-gray-700">{ATTR_LABELS[k as keyof PlayerMatchStats] ?? k}</span>
                      <span className="font-semibold text-gray-900">{Math.round(Number(v || 0))}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        )}
      </Card>

      {/* PAINEL 1 – Desempenho vs Time (últimas N partidas) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Desempenho vs Time (últimas N partidas)</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">N:</span>
            <select
              value={nMatchesPerf}
              onChange={(e) => setNMatchesPerf(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              value={perfView}
              onChange={(e) => setPerfView(e.target.value as any)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option>Top 10</option>
              <option>Todos</option>
            </select>
            <button
              onClick={() => setPerfCollapsed((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50"
            >
              {perfCollapsed ? "Maximizar" : "Minimizar"}
            </button>
          </div>
        </div>

        {!perfCollapsed && (
          <>
            {perfComparison?.me ? (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Eu vs média do time */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Você vs Média do Time</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCompare label="Gols" me={perfComparison.me.totalGoals} team={perfComparison.teamAvg.goals} />
                    <StatCompare
                      label="Assistências"
                      me={perfComparison.me.totalAssists}
                      team={perfComparison.teamAvg.assists}
                    />
                    <StatCompare label="Chutes" me={perfComparison.me.totalShots} team={perfComparison.teamAvg.shots} />
                    <StatCompare
                      label="Passe %"
                      me={perfComparison.me.passAccuracyPercent}
                      team={perfComparison.teamAvg.passAcc}
                      pct
                    />
                    <StatCompare
                      label="Desarmes"
                      me={perfComparison.me.totalTacklesMade}
                      team={perfComparison.teamAvg.tackles}
                    />
                    <StatCompare
                      label="Desarme %"
                      me={perfComparison.me.tackleSuccessPercent}
                      team={perfComparison.teamAvg.tackAcc}
                      pct
                    />
                    <StatCompare
                      label="Nota"
                      me={perfComparison.me.avgRating}
                      team={perfComparison.teamAvg.rating}
                      fixed2
                    />
                    <StatCompare
                      label="Vitórias %"
                      me={perfComparison.me.winPercent}
                      team={perfComparison.teamAvg.win}
                      pct
                    />
                  </div>
                </Card>

                {/* Ranking por Nota (Top X) */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Ranking por Nota</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm border">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Jogador</th>
                          <th className="p-2 text-right">Nota</th>
                          <th className="p-2 text-right">Gols</th>
                          <th className="p-2 text-right">Assist.</th>
                          <th className="p-2 text-right">Passe %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfComparison.sorted.map((r) => {
                          const isMe = String(r.playerId) === String(player.playerId);
                          return (
                            <tr key={r.playerId} className={`border-t ${isMe ? "bg-blue-50" : ""}`}>
                              <td className="p-2 text-left">
                                {r.playerName}
                                {isMe && " (Você)"}
                              </td>
                              <td className="p-2 text-right">{(r.avgRating ?? 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{r.totalGoals}</td>
                              <td className="p-2 text-right">{r.totalAssists}</td>
                              <td className="p-2 text-right">{fmtPct(r.passAccuracyPercent)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-gray-600 mt-3">Sem dados suficientes para comparação.</div>
            )}
          </>
        )}
      </Card>

      {/* PAINEL 2 – Atributos vs Time (APENAS último jogo do clube) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atributos – comparação (último jogo)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Comparar com:</label>
            <select
              value={String(attrCompareTarget)}
              onChange={(e) => {
                const v = e.target.value;
                setAttrCompareTarget(v === "avg" ? "avg" : Number(v));
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="avg">Média do time</option>
              {teamAttrs
                // opcional: remover o próprio jogador da lista de comparação
                .filter((t) => String(t.playerId) !== String(player.playerId))
                .map((t) => (
                  <option key={t.playerId} value={t.playerId}>
                    {t.playerName || `Jogador ${t.playerId}`}
                  </option>
                ))}
            </select>
            <button
              onClick={() => setAttrCollapsed((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50"
            >
              {attrCollapsed ? "Maximizar" : "Minimizar"}
            </button>
          </div>
        </div>

        {!attrCollapsed && (
          <>
            {attrComparison ? (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cards de comparação – TODOS os atributos */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">
                    Você vs <span className="text-gray-700">{attrComparison.label}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => {
                      const row = attrComparison.list.find((x) => x.key === key);
                      const label = ATTR_LABELS[key];
                      const mine = clamp01to100(row?.mine ?? 0);
                      const peer = clamp01to100(row?.peer ?? 0);
                      const better = mine >= peer;
                      return (
                        <div key={String(key)} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-800">{label}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                better ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {better ? "Acima" : "Na média/abaixo"}
                            </span>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] text-gray-500">Você: {Math.round(mine)}</div>
                            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                              <div className="h-2 bg-blue-600" style={{ width: `${mine}%` }} />
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] text-gray-500">
                              {attrComparison.label}: {Math.round(peer)}
                            </div>
                            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                              <div className="h-2 bg-slate-500" style={{ width: `${peer}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Seus melhores atributos (snapshot da partida exibida) */}
                <Card>
                  <h3 className="text-base font-semibold mb-3">Seus melhores atributos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(attrComparison.topMine || []).map((x) => (
                      <StatTile key={String(x.key)} label={ATTR_LABELS[x.key]} value={Math.round(x.mine)} />
                    ))}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-gray-600 mt-3">Sem dados suficientes para comparação.</div>
            )}
          </>
        )}
      </Card>

      {/* ATRIBUTOS TÉCNICOS (lista completa do jogador) */}
      {player.statistics && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">Atributos Técnicos (partida)</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-gray-700">
            {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => (
              <li key={String(key)} className="col-span-1">
                <ProgressBar value={Number((player.statistics as any)[key]) || 0} label={ATTR_LABELS[key]} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/**********************************
 * Subcomponentes auxiliares
 **********************************/
function StatCompare({
  label,
  me,
  team,
  pct = false,
  fixed2 = false,
}: {
  label: string;
  me: number;
  team: number;
  pct?: boolean;
  fixed2?: boolean;
}) {
  const m = Number(me || 0);
  const t = Number(team || 0);
  const isBetter = m >= t;
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">{label}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isBetter ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
          }`}
        >
          {isBetter ? "↑" : "→"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[11px] text-gray-500">Você</div>
          <div className="font-semibold">{pct ? fmtPct(m) : fixed2 ? m.toFixed(2) : fmtNum(m)}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Time (média)</div>
          <div className="font-semibold">{pct ? fmtPct(t) : fixed2 ? t.toFixed(2) : fmtNum(t)}</div>
        </div>
      </div>
    </div>
  );
}

/**********************************
 * Radar em SVG (sem libs)
 **********************************/
function RadarSVG({ data }: { data: { group: string; value: number }[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 100;
  const points = Math.max(3, data.length);

  const angleFor = (i: number) => (Math.PI * 2 * i) / points - Math.PI / 2;
  const toXY = (r: number, angle: number) => ({ x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) });

  const webLines = Array.from({ length: 5 }).map((_, ring) => {
    const r = radius * ((ring + 1) / 5);
    const d =
      data
        .map((_, i) => {
          const a = angleFor(i);
          const { x, y } = toXY(r, a);
          return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z";
    return <path key={ring} d={d} fill="none" stroke="#e5e7eb" strokeWidth={1} />;
  });

  const spokes = data.map((_, i) => {
    const a = angleFor(i);
    const { x, y } = toXY(radius, a);
    return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
  });

  const polygon =
    data
      .map((d, i) => {
        const a = angleFor(i);
        const r = (clamp01to100(d.value) / 100) * radius;
        const { x, y } = toXY(r, a);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm">
        <g>{webLines}</g>
        <g>{spokes}</g>
        <path d={polygon} fill="#3b82f6" fillOpacity={0.25} stroke="#3b82f6" strokeWidth={2} />
        {data.map((d, i) => {
          const a = angleFor(i);
          const { x, y } = toXY(radius + 16, a);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-600 text-[10px]"
            >
              {d.group}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
