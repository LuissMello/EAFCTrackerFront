// API Base URL
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8080';

// API Endpoints
export const API_ENDPOINTS = {
  // Clubs
  CLUBS: '/api/clubs',
  CLUB_OVERALL: (clubId: number) => `/api/Clubs/${clubId}/overall`,
  CLUB_PLAYOFFS: (clubId: number) => `/api/Clubs/${clubId}/playoffs`,
  CLUB_STATS: (clubId: number) => `/api/clubs/${clubId}/matches/statistics/limited`,
  CLUB_STATS_GROUPED: '/api/clubs/grouped/matches/statistics/limited',
  CLUB_MATCHES_RESULTS: (clubId: number) => `/api/clubs/${clubId}/matches/results`,
  CLUB_PLAYERS_ATTRIBUTES: (clubId: number) => `/api/clubs/${clubId}/players/attributes`,
  CLUB_GOAL_ANALYSIS: (clubId: number, from: string, to: string) =>
    `/api/Clubs/${clubId}/goals/analysis?from=${from}&to=${to}`,

  // Matches
  MATCH_GOALS: (matchId: string) => `/api/Matches/${matchId}/goals`,
  MATCH_STATISTICS: (matchId: string) => `/api/Matches/${matchId}/statistics`,
  MATCH_EVENT_AGGREGATES: (matchId: string) => `/api/Matches/${matchId}/event-aggregates`,
  MATCHES_STATS_BY_DATE: '/api/Clubs/matches/statistics/by-date-range-grouped',

  // Calendar
  CALENDAR: '/api/Calendar',
  CALENDAR_DAY: '/api/Calendar/day',

  // Trends
  TRENDS_CLUB: (clubId: number, last: number) => `/api/Trends/club/${clubId}?last=${last}`,
  TRENDS_TOP_SCORERS: (clubId: number, limit = 10) => `/api/Trends/top-scorers?clubId=${clubId}&limit=${limit}`,

  // Records / Opponents / Player Profile
  CLUB_RECORDS: (clubIds: string) => `/api/Clubs/records?clubIds=${clubIds}`,
  CLUB_OPPONENTS: (clubIds: string) => `/api/Clubs/opponents?clubIds=${clubIds}`,
  PLAYER_PROFILE: (playerEntityId: number) => `/api/Players/${playerEntityId}/profile`,

  // System
  FETCH_LAST_RUN: '/api/fetch/last-run',
  FETCH_RUN: '/api/fetch/run',
};

// External Asset URLs
const EA_CREST_BASE = 'https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/';
const EA_DIVISION_BASE = 'https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/';

export const FALLBACK_LOGO = 'https://via.placeholder.com/96?text=Logo';

export const crestUrl = (crestAssetId?: string | null): string => {
  return crestAssetId ? `${EA_CREST_BASE}l${crestAssetId}.png` : FALLBACK_LOGO;
};

export const divisionCrestUrl = (division?: string | null): string | null => {
  if (!division) return null;
  const n = Number(String(division).trim());
  // EA CDN only hosts badges for divisions 1–6; 7+ return 404
  return Number.isFinite(n) && n > 0 && n <= 6 ? `${EA_DIVISION_BASE}divisioncrest${Math.trunc(n)}.png` : null;
};

export const reputationTierUrl = (tier?: string | null): string => {
  const n = Number(tier);
  return `${EA_DIVISION_BASE}reputation-tier${n}.png`;
};
