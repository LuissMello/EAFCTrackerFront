import axios from 'axios';
import { API_BASE_URL } from '../config/urls.ts';

export const TOKEN_STORAGE_KEY = 'eafc_admin_token';
export const EXPIRES_STORAGE_KEY = 'eafc_admin_expires';
export const UNAUTHORIZED_EVENT = 'eafc:unauthorized';

/** Detalhe do evento `eafc:unauthorized` (disparado em qualquer 401). */
export interface UnauthorizedEventDetail {
    url?: string;
    /** Campo `code` do ProblemDetails: `unauthorized`, `token_expired`, `invalid_credentials`… */
    code?: string;
}

/** Lê o token de administrador do localStorage, sem lançar exceções. */
export function getStoredToken(): string | null {
    try {
        const v = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        return v && v.trim() ? v.trim() : null;
    } catch {
        return null;
    }
}

/** Expiração (ISO UTC) do token armazenado, ou null. */
export function getStoredExpiry(): string | null {
    try {
        const v = window.localStorage.getItem(EXPIRES_STORAGE_KEY);
        return v && v.trim() ? v.trim() : null;
    } catch {
        return null;
    }
}

export function setStoredSession(token: string, expiresAtUtc: string | null): void {
    try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
        if (expiresAtUtc) window.localStorage.setItem(EXPIRES_STORAGE_KEY, expiresAtUtc);
        else window.localStorage.removeItem(EXPIRES_STORAGE_KEY);
    } catch {
        /* storage indisponível */
    }
}

export function clearStoredSession(): void {
    try {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(EXPIRES_STORAGE_KEY);
    } catch {
        /* storage indisponível */
    }
}

// Modelo antigo: chave de API colada e guardada no navegador. Remove o resquício.
try {
    window.localStorage.removeItem('eafc_api_key');
} catch {
    /* storage indisponível */
}

// Padrão típico de mojibake (UTF-8 lido como Latin-1): "Ã" ou "Â" seguidos de byte 0x80–0xBF
const MOJIBAKE_RE = /Ã[\u0080-¿]|Â[\u0080-¿]/;
const utf8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;

/**
 * Repara strings com UTF-8 duplamente codificado.
 * E.g. "TrovÃ£o" (Latin-1 interpretation of UTF-8 bytes) → "Trovão".
 * Só tenta reparar se a string casar com um padrão real de mojibake e retorna a original se falhar.
 */
function fixDoubleEncodedUtf8(str: string): string {
    if (!utf8Decoder || !MOJIBAKE_RE.test(str)) return str;
    try {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c > 0xff) return str; // não é Latin-1 puro → não é o caso
            bytes[i] = c;
        }
        return utf8Decoder.decode(bytes);
    } catch {
        return str;
    }
}

/** Percorre o payload e só cria novos objetos/arrays quando algo realmente mudou. */
function fixStringsDeep(obj: any): any {
    if (typeof obj === 'string') return fixDoubleEncodedUtf8(obj);
    if (Array.isArray(obj)) {
        let out: any[] | null = null;
        for (let i = 0; i < obj.length; i++) {
            const v = fixStringsDeep(obj[i]);
            if (v !== obj[i] && out === null) out = obj.slice();
            if (out !== null) out[i] = v;
        }
        return out ?? obj;
    }
    if (obj !== null && typeof obj === 'object') {
        let out: any = null;
        for (const key of Object.keys(obj)) {
            const v = fixStringsDeep(obj[key]);
            if (v !== obj[key] && out === null) out = { ...obj };
            if (out !== null) out[key] = v;
        }
        return out ?? obj;
    }
    return obj;
}

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
        config.headers = config.headers ?? ({} as any);
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        if (response.data && typeof response.data === 'object') {
            response.data = fixStringsDeep(response.data);
        }
        return response;
    },
    (error) => {
        if (error?.response?.status === 401) {
            try {
                const code = error?.response?.data?.code;
                const detail: UnauthorizedEventDetail = {
                    url: error?.config?.url,
                    code: typeof code === 'string' ? code : undefined,
                };
                window.dispatchEvent(new CustomEvent<UnauthorizedEventDetail>(UNAUTHORIZED_EVENT, { detail }));
            } catch {
                /* ignore */
            }
        }
        return Promise.reject(error);
    }
);

/** True quando o erro é um cancelamento (AbortController / axios cancel). */
export function isCanceled(e: unknown): boolean {
    return axios.isCancel(e) || (e as any)?.code === 'ERR_CANCELED' || (e as any)?.name === 'CanceledError' || (e as any)?.name === 'AbortError';
}

/** True quando o erro é uma resposta HTTP 401. */
export function isUnauthorized(e: unknown): boolean {
    return (e as any)?.response?.status === 401;
}

export default api;
