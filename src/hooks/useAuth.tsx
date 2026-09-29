import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api, {
    EXPIRES_STORAGE_KEY,
    TOKEN_STORAGE_KEY,
    UNAUTHORIZED_EVENT,
    clearStoredSession,
    getStoredExpiry,
    getStoredToken,
    isCanceled,
    isUnauthorized,
    setStoredSession,
} from "../services/api.ts";
import type { UnauthorizedEventDetail } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import LoginModal from "../components/LoginModal.tsx";
import { parseTimestamp } from "../utils/date.ts";

export const MSG_LOGIN_REQUIRED = "Faça login de administrador para continuar.";
export const MSG_SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";

type Session = { token: string; expiresAtUtc: string | null };

type AuthContextType = {
    /** Sessão de administrador: token local válido OU servidor com acesso administrativo aberto (ex.: Development sem chave) */
    isAdmin: boolean;
    /** Há um token de login (permite "Sair"); false quando o acesso é aberto pelo próprio servidor */
    hasSession: boolean;
    /** O servidor aceitou /api/admin/me sem login (modo local/aberto) */
    openAccess: boolean;
    expiresAtUtc: string | null;
    /** True enquanto a sessão é verificada (GET /api/admin/me) na abertura do site */
    checking: boolean;
    login: (password: string) => Promise<void>;
    logout: () => void;
    /** Abre o modal de login (com mensagem opcional) */
    openLogin: (message?: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Lê a sessão do storage; descarta se já expirou. */
function readSession(): Session | null {
    const token = getStoredToken();
    if (!token) return null;
    const expiresAtUtc = getStoredExpiry();
    const exp = parseTimestamp(expiresAtUtc);
    if (exp && exp.getTime() <= Date.now()) {
        clearStoredSession();
        return null;
    }
    return { token, expiresAtUtc };
}

// setTimeout estoura acima de 2^31-1 ms
const MAX_TIMER_MS = 2_147_000_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(readSession);
    const [checking, setChecking] = useState<boolean>(true);
    const [openAccess, setOpenAccess] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [loginMessage, setLoginMessage] = useState<string | null>(null);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const openLogin = useCallback((message?: string) => {
        setLoginMessage(message ?? null);
        setLoginOpen(true);
    }, []);

    const closeLogin = useCallback(() => {
        setLoginOpen(false);
        setLoginMessage(null);
    }, []);

    const logout = useCallback(() => {
        clearStoredSession();
        setSession(null);
    }, []);

    const login = useCallback(async (password: string) => {
        const { data } = await api.post<{ token: string; expiresAtUtc?: string | null }>(API_ENDPOINTS.AUTH_LOGIN, { password });
        if (!data?.token) throw new Error("Resposta de login inválida");
        const expiresAtUtc = typeof data.expiresAtUtc === "string" ? data.expiresAtUtc : null;
        setStoredSession(data.token, expiresAtUtc);
        if (!mountedRef.current) return;
        setSession({ token: data.token, expiresAtUtc });
        setLoginOpen(false);
        setLoginMessage(null);
    }, []);

    // Ao abrir o site: pergunta ao servidor se há acesso administrativo (com o token guardado, se houver).
    // 200 sem token = servidor com acesso aberto (ex.: Development sem chave) → libera o menu Admin.
    // 401 → limpa um token velho em silêncio.
    useEffect(() => {
        const hadToken = readSession() !== null;
        const controller = new AbortController();
        (async () => {
            try {
                const { data } = await api.get<{ authenticated?: boolean; expiresAtUtc?: string | null }>(API_ENDPOINTS.ADMIN_ME, {
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                if (!hadToken) {
                    setOpenAccess(true);
                } else if (typeof data?.expiresAtUtc === "string") {
                    const token = getStoredToken();
                    if (token) setStoredSession(token, data.expiresAtUtc);
                    setSession((s) => (s ? { ...s, expiresAtUtc: data.expiresAtUtc as string } : s));
                }
            } catch (e: any) {
                if (controller.signal.aborted || isCanceled(e)) return;
                setOpenAccess(false);
                if (isUnauthorized(e) && hadToken) {
                    clearStoredSession();
                    setSession(null);
                }
                // outros erros (rede/5xx): mantém o token local; o primeiro 401 real cuida do resto
            } finally {
                if (!controller.signal.aborted) setChecking(false);
            }
        })();
        return () => controller.abort();
    }, []);

    // Qualquer 401 de chamada protegida: limpa o token velho e pede login
    useEffect(() => {
        const onUnauthorized = (ev: Event) => {
            const detail = (ev as CustomEvent<UnauthorizedEventDetail>).detail;
            const url = detail?.url ?? "";
            // Login (senha errada) e validação inicial têm tratamento próprio
            if (url.includes(API_ENDPOINTS.AUTH_LOGIN) || url.includes(API_ENDPOINTS.ADMIN_ME)) return;
            clearStoredSession();
            setSession(null);
            openLogin(detail?.code === "token_expired" ? MSG_SESSION_EXPIRED : MSG_LOGIN_REQUIRED);
        };
        window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    }, [openLogin]);

    // Sincroniza login/logout entre abas
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== null && e.key !== TOKEN_STORAGE_KEY && e.key !== EXPIRES_STORAGE_KEY) return;
            setSession(readSession());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    // Sessão expira sozinha no horário informado pelo servidor
    const expiresAtUtc = session?.expiresAtUtc ?? null;
    const hasSession = session !== null;
    useEffect(() => {
        if (!hasSession) return;
        const exp = parseTimestamp(expiresAtUtc);
        if (!exp) return;
        const ms = exp.getTime() - Date.now();
        const id = setTimeout(() => {
            clearStoredSession();
            setSession(null);
        }, Math.min(Math.max(ms, 0), MAX_TIMER_MS));
        return () => clearTimeout(id);
    }, [hasSession, expiresAtUtc]);

    const value = useMemo<AuthContextType>(
        () => ({ isAdmin: hasSession || openAccess, hasSession, openAccess, expiresAtUtc, checking, login, logout, openLogin }),
        [hasSession, openAccess, expiresAtUtc, checking, login, logout, openLogin]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
            <LoginModal open={loginOpen} message={loginMessage} onClose={closeLogin} onSubmit={login} />
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
    return ctx;
}
