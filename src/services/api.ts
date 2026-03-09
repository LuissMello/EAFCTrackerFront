import axios from 'axios';
import { API_BASE_URL } from '../config/urls.ts';

/**
 * Repair double-encoded UTF-8 strings returned by the backend.
 * E.g. "TrovÃ£o" (Latin-1 interpretation of UTF-8 bytes) → "Trovão"
 */
function fixDoubleEncodedUtf8(str: string): string {
    try {
        // Only process strings that contain bytes in the 0x80–0xFF range (sign of double-encoding)
        if (!/[\x80-\xff]/.test(str)) return str;
        const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)));
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        return str;
    }
}

function fixStringsDeep(obj: any): any {
    if (typeof obj === 'string') return fixDoubleEncodedUtf8(obj);
    if (Array.isArray(obj)) return obj.map(fixStringsDeep);
    if (obj !== null && typeof obj === 'object') {
        const out: any = {};
        for (const key of Object.keys(obj)) {
            out[key] = fixStringsDeep(obj[key]);
        }
        return out;
    }
    return obj;
}

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.response.use((response) => {
    if (response.data && typeof response.data === 'object') {
        response.data = fixStringsDeep(response.data);
    }
    return response;
});

export default api;
