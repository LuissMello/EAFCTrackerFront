// src/types/playerAttributes.ts

/** Atributos de jogador numa partida (espelha o backend, em pt-BR). */
export type PlayerMatchStats = {
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
