import type { SyntheticEvent } from 'react';

// API Base URL
// Em build de produção a variável é obrigatória (evita publicar um bundle apontando para localhost).
const ENV_API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
if (!ENV_API_BASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('REACT_APP_API_BASE_URL não está definida no build de produção.');
}
export const API_BASE_URL = ENV_API_BASE_URL || 'http://localhost:5000';

// API Endpoints
export const API_ENDPOINTS = {
  // Clubs
  CLUBS: '/api/clubs',
  CLUB_OVERALL: (clubId: number) => `/api/Clubs/${clubId}/overall`,
  CLUB_MATCHES_OVERALL: (clubId: number, pageSize = 50, page = 1) =>
    `/api/Clubs/${clubId}/matches/overall?page=${page}&pageSize=${pageSize}`,
  CLUB_PLAYOFFS: (clubId: number) => `/api/Clubs/${clubId}/playoffs`,
  CLUB_STATS: (clubId: number) => `/api/clubs/${clubId}/matches/statistics/limited`,
  CLUB_STATS_GROUPED: '/api/clubs/grouped/matches/statistics/limited',
  CLUB_MATCHES_RESULTS: (clubId: number) => `/api/clubs/${clubId}/matches/results`,
  CLUB_PLAYERS_ATTRIBUTES: (clubId: number) => `/api/clubs/${clubId}/players/attributes`,
  CLUB_GOAL_ANALYSIS: (clubId: number, from: string, to: string) =>
    `/api/Clubs/${clubId}/goals/analysis?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  CLUB_MATCHES_RESULTS_MULTI: '/api/clubs/matches/results',

  // Matches
  MATCH_GOALS: (matchId: string) => `/api/Matches/${matchId}/goals`,
  MATCH_STATISTICS: (matchId: string) => `/api/Matches/${matchId}/statistics`,
  MATCH_EVENT_AGGREGATES: (matchId: string) => `/api/Matches/${matchId}/event-aggregates`,
  MATCHES_STATS_BY_DATE: '/api/Clubs/matches/statistics/by-date-range-grouped',

  // Calendar
  CALENDAR: '/api/Calendar',
  CALENDAR_DAY: '/api/Calendar/day',
  CALENDAR_SESSION_MEMBERSHIPS: '/api/Calendar/session-memberships',

  // Trends
  TRENDS_CLUB: (clubId: number, last: number) => `/api/Trends/club/${clubId}?last=${last}`,
  TRENDS_TOP_SCORERS: (clubId: number, limit = 10, last = 30) => `/api/Trends/top-scorers?clubId=${clubId}&limit=${limit}&last=${last}`,

  // Records / Opponents / Player Profile
  CLUB_RECORDS: (clubIds: string) => `/api/Clubs/records?clubIds=${clubIds}`,
  CLUB_OPPONENTS: (clubIds: string) => `/api/Clubs/opponents?clubIds=${clubIds}`,
  PLAYER_PROFILE: (playerEntityId: number) => `/api/Players/${playerEntityId}/profile`,

  // System
  FETCH_LAST_RUN: '/api/fetch/last-run',
  FETCH_RUN: '/api/fetch/run',
  FETCH_LIVE: '/api/fetch/live',

  // Versões do jogo (público)
  GAME_VERSIONS: '/api/game-versions',

  // Autenticação
  AUTH_LOGIN: '/api/auth/login',
  ADMIN_ME: '/api/admin/me',

  // Admin
  ADMIN_GAME_VERSIONS: '/api/admin/game-versions',
  ADMIN_GAME_VERSION_CURRENT: (version: number) => `/api/admin/game-versions/${version}/current`,
  ADMIN_TRACKED_CLUB_VERSION: (clubId: number) => `/api/admin/tracked-clubs/${clubId}/game-version`,
  ADMIN_PING: '/api/admin/ping',
  ADMIN_SETTINGS: '/api/admin/settings',
  ADMIN_SETTING: (key: string) => `/api/admin/settings/${encodeURIComponent(key)}`,
  ADMIN_CLUB_SEARCH: (name: string) => `/api/admin/clubs/search?name=${encodeURIComponent(name)}`,
  ADMIN_TRACKED_CLUBS: '/api/admin/tracked-clubs',
  ADMIN_TRACKED_CLUB: (clubId: number) => `/api/admin/tracked-clubs/${clubId}`,
  ADMIN_SESSION_SETTINGS: (clubId: number) => `/api/admin/tracked-clubs/${clubId}/session-settings`,
  ADMIN_SESSION_BOUNDARY: (clubId: number, matchId: number) => `/api/admin/tracked-clubs/${clubId}/session-boundaries/${matchId}`,
  ADMIN_GOAL_REG_LINK_PENDING: '/api/admin/goal-registrations/link-pending',

  // Registro de gols antecipado (público)
  GOAL_REGISTRATIONS: '/api/goal-registrations',
  GOAL_REGISTRATION: (id: number) => `/api/goal-registrations/${id}`,
  GOAL_REG_CURRENT: (clubId: number) => `/api/goal-registrations/current?clubId=${clubId}`,
  GOAL_REG_GOALS: (id: number) => `/api/goal-registrations/${id}/goals`,
  GOAL_REG_GOAL: (id: number, goalId: number) => `/api/goal-registrations/${id}/goals/${goalId}`,
  GOAL_REGISTRATIONS_BY_CLUB: (clubId: number, limit = 50) => `/api/goal-registrations?clubId=${clubId}&limit=${limit}`,
  GOAL_REG_ROSTER: (clubId: number) => `/api/goal-registrations/roster?clubId=${clubId}`,
  GOAL_REG_OPPONENT_SEARCH: (q: string, clubId: number, limit = 15) =>
    `/api/goal-registrations/opponents/search?q=${encodeURIComponent(q)}&clubId=${clubId}&limit=${limit}`,
  GOAL_REG_OPPONENT_PREVIEW: (opponentClubId: number, clubId: number, name?: string | null) =>
    `/api/goal-registrations/opponents/${opponentClubId}/preview?clubId=${clubId}${name ? `&name=${encodeURIComponent(name)}` : ''}`,
};

// External Asset URLs
const EA_CREST_BASE = 'https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/';
const EA_DIVISION_BASE = 'https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/';

// Logo de fallback embutido (SVG inline) — não depende de nenhum host externo.
export const FALLBACK_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      '<rect width="96" height="96" rx="48" fill="#E5E7EB"/>' +
      '<path d="M48 18l24 9v18c0 16-10 28-24 33C34 73 24 61 24 45V27l24-9z" fill="none" stroke="#9CA3AF" stroke-width="4" stroke-linejoin="round"/>' +
      '</svg>'
  );

/**
 * onError para <img>: troca para FALLBACK_LOGO uma única vez (evita loop se o fallback também falhar).
 */
export const onImgError = (e: SyntheticEvent<HTMLImageElement>): void => {
  const img = e.currentTarget;
  img.onerror = null;
  if (img.getAttribute('src') === FALLBACK_LOGO) return;
  img.src = FALLBACK_LOGO;
};

/** onError para <img> decorativa: apenas esconde a imagem. */
export const hideImgOnError = (e: SyntheticEvent<HTMLImageElement>): void => {
  const img = e.currentTarget;
  img.onerror = null;
  img.style.display = 'none';
};

export const crestUrl = (crestAssetId?: string | null): string => {
  return crestAssetId ? `${EA_CREST_BASE}l${crestAssetId}.png` : FALLBACK_LOGO;
};

export const divisionCrestUrl = (division?: string | number | null): string | null => {
  if (division === null || division === undefined || division === '') return null;
  const n = Number(String(division).trim());
  // EA CDN only hosts badges for divisions 1–6; 7+ return 404
  return Number.isFinite(n) && n > 0 && n <= 6 ? `${EA_DIVISION_BASE}divisioncrest${Math.trunc(n)}.png` : null;
};

/** Retorna null quando o tier é inválido (evita URLs como "reputation-tierNaN.png"). */
export const reputationTierUrl = (tier?: string | number | null): string | null => {
  if (tier === null || tier === undefined || String(tier).trim() === '') return null;
  const n = Number(tier);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${EA_DIVISION_BASE}reputation-tier${Math.trunc(n)}.png`;
};
