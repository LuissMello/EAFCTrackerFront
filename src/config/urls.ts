// API Base URL
export const API_BASE_URL = 'https://eafctracker2-hhahgrf9cdb9b5f4.brazilsouth-01.azurewebsites.net';

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

  // Matches
  MATCH_GOALS: (matchId: string) => `/api/Matches/${matchId}/goals`,
  MATCHES_STATS_BY_DATE: '/api/Clubs/matches/statistics/by-date-range-grouped',

  // Calendar
  CALENDAR: '/api/Calendar',
  CALENDAR_DAY: '/api/Calendar/day',

  // Trends
  TRENDS_CLUB: (clubId: number, last: number) => `/api/Trends/club/${clubId}?last=${last}`,
  TRENDS_TOP_SCORERS: (clubId: number, limit = 10) => `/api/Trends/top-scorers?clubId=${clubId}&limit=${limit}`,

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
  return Number.isFinite(n) && n > 0 ? `${EA_DIVISION_BASE}divisioncrest${Math.trunc(n)}.png` : null;
};

export const reputationTierUrl = (tier?: string | null): string => {
  const n = Number(tier);
  return `${EA_DIVISION_BASE}reputation-tier${n}.png`;
};
