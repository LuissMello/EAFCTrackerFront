// src/utils/playerAttributes.ts
import type { PlayerMatchStats } from "../types/playerAttributes.ts";

/** tenta ler tanto camelCase quanto PascalCase */
export function pick<T = any>(obj: any, camel: string, pascal: string): T {
  if (!obj) return undefined as any;
  if (camel in obj) return obj[camel];
  if (pascal in obj) return obj[pascal];
  return undefined as any;
}

/** Mapeador resiliente (camel/Pascal) dos atributos vindos do backend. */
export function mapAttr(be?: any | null): PlayerMatchStats | null {
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



/** Rótulos de exibição dos atributos. */
export const ATTR_LABELS: Record<keyof PlayerMatchStats, string> = {
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

/** Agrupamento dos atributos (radar/médias); `onlyGK` só aparece para goleiros. */
export const GROUPS: Array<{ name: string; keys: (keyof PlayerMatchStats)[]; onlyGK?: boolean }> = [
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
