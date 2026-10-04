import React from "react";
import { Link, useLocation } from "react-router-dom";
import MultiClubPicker from "./MultiClubPicker.tsx";
import ThemeToggle from "./ThemeToggle.tsx";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { parseTimestamp } from "../utils/date.ts";
import { useAuth } from "../hooks/useAuth.tsx";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { useLiveMode } from "../hooks/useLiveMode.tsx";

type LastRunResponse = { lastFetchedAtUtc?: string | null };
type RunResponse = { skipped?: boolean; hadErrors?: boolean; errors?: string[] } | null | undefined;
type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const UNITS: [Unit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
];

/** Datas anteriores a 2000 (ex.: o valor "zero" do backend) são tratadas como "nunca". */
const MIN_VALID_RUN_MS = Date.UTC(2000, 0, 1);

function formatTimeAgo(iso?: string | null): string {
    if (!iso) return "Nunca";
    const then = parseTimestamp(iso)?.getTime();
    // Data "zero" do backend (0001-01-01) = nunca buscou
    if (then === undefined || then < MIN_VALID_RUN_MS) return "Nunca";
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 5 && diffSec > -5) return "agora";
    const abs = Math.abs(diffSec);
    for (const [unit, inSec] of UNITS) {
        const value = Math.floor(abs / inSec);
        if (value >= 1) return rtf.format(-value, unit);
    }
    return rtf.format(-abs, "second");
}

function freshnessDot(iso?: string | null): string {
    if (!iso) return "bg-negative";
    const t = parseTimestamp(iso)?.getTime();
    if (t === undefined || t < MIN_VALID_RUN_MS) return "bg-negative";
    const diffMin = (Date.now() - t) / 60000;
    if (diffMin < 30) return "bg-positive";
    if (diffMin < 120) return "bg-warning";
    return "bg-negative";
}

type NavLink = { to: string; label: string; wide?: boolean };

// Ordem do menu principal definida pelo usuário: Partidas primeiro, depois a sequência pedida; o restante por último.
// `wide`: só aparece na barra desktop em telas largas (>= xl); abaixo disso o link cai no menu "Mais"
// (sempre preservando a ordem relativa). O menu mobile mostra todos, na mesma ordem.
const NAV_ORDER: NavLink[] = [
    { to: "/", label: "Partidas" },
    { to: "/statisticsbydate", label: "Stats Período" },
    { to: "/noite-de-jogo", label: "Noite de jogo" },
    { to: "/calendar", label: "Calendário" },
    { to: "/singlestatisticsbydate", label: "Stats Individuais", wide: true },
    { to: "/overall-evolution", label: "Evolução", wide: true },
    { to: "/goal-analytics", label: "Gols", wide: true },
    { to: "/registrar-gols", label: "Registrar gols" },
    { to: "/stats", label: "Estatísticas", wide: true },
    { to: "/trends", label: "Tendências", wide: true },
];

const NAV_WIDE: NavLink[] = NAV_ORDER.filter((l) => l.wide);

// Rotas secundárias (menu "Mais"). /laboratorio e /cartas continuam existindo (rotas e páginas intactas), mas fora do menu por ora. Admin permanece visível; a própria página exige login.
const MORE_LINKS: NavLink[] = [
    { to: "/records", label: "Recordes" },
    { to: "/opponents", label: "Adversários" },
    { to: "/attributes", label: "Atributos" },
    { to: "/retrospectiva", label: "Retrospectiva" },
    { to: "/admin", label: "Admin" },
];

// Ordem completa (menu mobile)
const ALL_LINKS: NavLink[] = [...NAV_ORDER, ...MORE_LINKS];

/** Ativo quando o caminho é exatamente `to` ou está dentro dele (`to/...`). */
function isPathActive(pathname: string, to: string): boolean {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(to + "/");
}

function Spinner() {
    return (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
    );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
    return (
        <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            className={spinning ? "animate-spin" : ""}
        >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
    );
}

const fmtExpiry = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Fecha um popover ao clicar fora / Escape (só enquanto aberto). */
function useDismissable(
    open: boolean,
    setOpen: (v: boolean) => void,
    containerRef: React.RefObject<HTMLElement>,
    triggerRef: React.RefObject<HTMLElement>
) {
    React.useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, setOpen, containerRef, triggerRef]);
}

export default function Navbar() {
    const location = useLocation();
    const { isAdmin, hasSession, expiresAtUtc, logout } = useAuth();
    const { triggerRefresh } = useRefresh();
    const { live, liveBusy, liveError, toggleLive, liveLabel, liveTitle } = useLiveMode();

    const [menuOpen, setMenuOpen] = React.useState(false);
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [adminOpen, setAdminOpen] = React.useState(false);
    const navRef = React.useRef<HTMLElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const menuBtnRef = React.useRef<HTMLButtonElement>(null);
    const moreRef = React.useRef<HTMLDivElement>(null);
    const moreBtnRef = React.useRef<HTMLButtonElement>(null);
    const adminRef = React.useRef<HTMLDivElement>(null);
    const adminBtnRef = React.useRef<HTMLButtonElement>(null);
    const mobileMenuId = React.useId();
    const moreMenuId = React.useId();
    const adminMenuId = React.useId();

    const [lastRunUtc, setLastRunUtc] = React.useState<string | null>(null);
    const [loadingLastRun, setLoadingLastRun] = React.useState<boolean>(true);
    const [running, setRunning] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [refreshSpin, setRefreshSpin] = React.useState(false);

    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Publica a altura real do cabeçalho (varia com quebra de linha/menu mobile) para barras "sticky" logo abaixo
    React.useEffect(() => {
        const el = navRef.current;
        if (!el) return;
        const root = document.documentElement;
        const publish = () => root.style.setProperty("--nav-h", `${el.offsetHeight}px`);
        publish();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(publish);
        ro.observe(el);
        return () => {
            ro.disconnect();
            root.style.removeProperty("--nav-h");
        };
    }, []);

    const fetchLastRun = React.useCallback(async () => {
        try {
            setLoadingLastRun(true);
            setError(null);
            const { data } = await api.get<LastRunResponse>(API_ENDPOINTS.FETCH_LAST_RUN);
            if (!mountedRef.current) return;
            setLastRunUtc(data?.lastFetchedAtUtc ?? null);
        } catch (e: any) {
            if (!mountedRef.current) return;
            setError("Falha ao obter última busca");
            console.error(e);
        } finally {
            if (mountedRef.current) setLoadingLastRun(false);
        }
    }, []);

    React.useEffect(() => { fetchLastRun(); }, [fetchLastRun]);

    // Fecha menus ao navegar
    React.useEffect(() => {
        setMenuOpen(false);
        setMoreOpen(false);
        setAdminOpen(false);
    }, [location.pathname]);

    useDismissable(menuOpen, setMenuOpen, menuRef, menuBtnRef);
    useDismissable(moreOpen, setMoreOpen, moreRef, moreBtnRef);
    useDismissable(adminOpen, setAdminOpen, adminRef, adminBtnRef);

    const [, forceTick] = React.useState(0);
    React.useEffect(() => {
        const id = setInterval(() => forceTick(t => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const handleRunFetch = React.useCallback(async () => {
        try {
            setRunning(true);
            setError(null);
            setNotice(null);
            const { data } = await api.post<RunResponse>(API_ENDPOINTS.FETCH_RUN, {});
            if (!mountedRef.current) return;
            await fetchLastRun();
            if (data?.skipped) {
                setNotice("Busca recente já realizada — aguarde alguns instantes para buscar de novo.");
            } else if (data?.hadErrors) {
                const affected = (data.errors ?? []).slice(0, 3).join("; ");
                setNotice(`Busca parcialmente concluída. Algumas partidas não foram atualizadas.${affected ? ` Falhas: ${affected}` : ""}`);
            }
            // Busca concluída: as páginas releem os dados do backend
            if (mountedRef.current) triggerRefresh();
        } catch (e: any) {
            if (!mountedRef.current) return;
            const msg = e?.response?.data ?? e?.message ?? "Falha ao disparar busca";
            setError(typeof msg === "string" ? msg : "Erro inesperado ao buscar");
            console.error(e);
        } finally {
            if (mountedRef.current) setRunning(false);
        }
    }, [fetchLastRun, triggerRefresh]);

    const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    React.useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
    const handleRefresh = React.useCallback(() => {
        triggerRefresh();
        setRefreshSpin(true);
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => setRefreshSpin(false), 700);
    }, [triggerRefresh]);

    const lastRunLabel = loadingLastRun ? "Carregando…" : error && !lastRunUtc ? "Indisponível" : formatTimeAgo(lastRunUtc);
    const dotClass = loadingLastRun ? "bg-slate-500" : error && !lastRunUtc ? "bg-warning" : freshnessDot(lastRunUtc);

    const isActive = (to: string) => isPathActive(location.pathname, to);
    const moreActive = [...MORE_LINKS, ...NAV_WIDE].some((l) => isActive(l.to));

    const expiryText = React.useMemo(() => {
        const d = parseTimestamp(expiresAtUtc);
        return d ? `Sessão até ${fmtExpiry.format(d)}` : null;
    }, [expiresAtUtc]);

    const ctrlBase =
        "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
    // Barra desktop compacta (altura 28px)
    const ctrlSm = "lg:py-1 lg:text-[13px] lg:leading-5";

    const fetchBtn = (fullWidth = false) => (
        <button
            type="button"
            onClick={handleRunFetch}
            disabled={running}
            className={`${ctrlBase} ${ctrlSm} ${fullWidth ? "flex-1" : ""} ${
                running
                    ? "bg-white/10 text-slate-300 cursor-not-allowed"
                    : "bg-accent text-accent-fg hover:brightness-110"
            }`}
            title="Disparar coleta agora"
        >
            {running ? <><Spinner /> Buscando…</> : "Buscar partidas"}
        </button>
    );

    const refreshBtn = (fullWidth = false) => (
        <button
            type="button"
            onClick={handleRefresh}
            className={`${ctrlBase} ${ctrlSm} ${fullWidth ? "flex-1" : ""} bg-white/10 text-slate-100 hover:bg-white/20 border border-white/15`}
            title="Recarregar os dados exibidos (não busca partidas novas na EA)"
        >
            <RefreshIcon spinning={refreshSpin} />
            Atualizar
        </button>
    );

    const liveBtn = (fullWidth = false) => (
        <button
            type="button"
            onClick={toggleLive}
            disabled={liveBusy}
            aria-pressed={live.enabled}
            aria-label={`${live.enabled ? "Desligar modo ao vivo" : "Ligar modo ao vivo"} — vale para todos os visitantes`}
            title={liveTitle}
            className={`${ctrlBase} ${ctrlSm} ${fullWidth ? "w-full" : ""} border ${
                live.enabled
                    ? "bg-green-500/15 border-green-500/60 text-green-300 hover:bg-green-500/25"
                    : "bg-white/10 border-white/15 text-slate-100 hover:bg-white/20"
            } ${liveBusy ? "cursor-wait opacity-80" : ""}`}
        >
            {liveBusy ? (
                <span
                    aria-hidden="true"
                    className={`inline-block w-3 h-3 rounded-full border-2 animate-spin ${
                        live.enabled ? "border-green-300/40 border-t-green-300" : "border-white/30 border-t-white"
                    }`}
                />
            ) : (
                <span
                    aria-hidden="true"
                    className={`inline-block w-2 h-2 rounded-full ${live.enabled ? "bg-green-400 animate-pulse" : "bg-gray-400"}`}
                />
            )}
            {liveBusy ? (live.enabled ? "Desligando…" : "Ligando…") : liveLabel}
        </button>
    );

    const lastRunInfo = (small = false) => (
        <div className={`flex items-center gap-1.5 ${small ? "text-[11px]" : "text-xs"} text-slate-300 whitespace-nowrap`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span>
                Última busca: <span className="font-semibold text-slate-100">{lastRunLabel}</span>
            </span>
        </div>
    );

    const loginBtn = (fullWidth = false) => (
        <Link
            to="/admin"
            onClick={() => setMenuOpen(false)}
            className={`${ctrlBase} ${ctrlSm} ${fullWidth ? "w-full" : ""} border border-white/25 text-slate-100 hover:bg-white/10`}
            title="Abrir página de administração e entrar"
        >
            <LockIcon />
            Admin
        </Link>
    );

    const linkCls = (active: boolean) =>
        `px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            active ? "bg-white/10 text-white border-b-2 border-accent" : "text-slate-300 hover:text-white hover:bg-white/10"
        }`;

    return (
        <nav ref={navRef} className="sticky top-0 z-40 bg-[#0B1220] text-slate-100 px-3 sm:px-5 py-1 border-b border-white/10" aria-label="Navegação principal">
            {/* Barra principal */}
            <div className="flex items-center gap-2">
                {/* Logo */}
                <Link to="/" aria-label="EAFC Tracker — início" className="flex items-center gap-2 whitespace-nowrap mr-1">
                    <span className="inline-block w-1.5 h-5 rounded-sm bg-accent flex-shrink-0" />
                    <span className="font-display font-bold text-lg uppercase tracking-wide leading-none">
                        EAFC<span className="hidden min-[400px]:inline"> <span className="text-accent-bright">Tracker</span></span>
                    </span>
                </Link>
                <span className="hidden lg:block w-px h-4 bg-white/15 flex-shrink-0 mx-1" />

                {/* Links — desktop (>= lg) */}
                <div className="hidden lg:flex items-center gap-0.5">
                    {NAV_ORDER.map(({ to, label, wide }) => (
                        <Link
                            key={to}
                            to={to}
                            aria-current={isActive(to) ? "page" : undefined}
                            className={`${wide ? "hidden xl:inline-block " : ""}${linkCls(isActive(to))}`}
                        >
                            {label}
                        </Link>
                    ))}

                    {/* Menu "Mais" */}
                    <div className="relative" ref={moreRef}>
                        <button
                            ref={moreBtnRef}
                            type="button"
                            onClick={() => setMoreOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={moreOpen}
                            aria-controls={moreMenuId}
                            className={`${linkCls(moreActive)} flex items-center gap-1`}
                        >
                            Mais
                            <svg
                                width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                                className={`transition-transform duration-150 ${moreOpen ? "rotate-180" : ""}`}
                            >
                                <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
                            </svg>
                        </button>
                        <div
                            id={moreMenuId}
                            role="menu"
                            aria-hidden={!moreOpen}
                            className={`absolute left-0 mt-2 w-48 bg-[#0B1220] border border-white/15 rounded-lg shadow-raised py-1 z-50 transition-opacity duration-100 ${
                                moreOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                            }`}
                        >
                            {NAV_WIDE.map(({ to, label }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    role="menuitem"
                                    onClick={() => setMoreOpen(false)}
                                    aria-current={isActive(to) ? "page" : undefined}
                                    className={`xl:hidden block px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-white/15 ${
                                        isActive(to) ? "bg-white/15 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
                                    }`}
                                >
                                    {label}
                                </Link>
                            ))}
                            {MORE_LINKS.map(({ to, label }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    role="menuitem"
                                    onClick={() => setMoreOpen(false)}
                                    aria-current={isActive(to) ? "page" : undefined}
                                    className={`block px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-white/15 ${
                                        isActive(to) ? "bg-white/15 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
                                    }`}
                                >
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Seletor de clubes compacto — sempre visível no mobile/tablet (< lg) */}
                <div className="lg:hidden flex-1 min-w-0 ml-1">
                    <MultiClubPicker compact />
                </div>

                {/* Cluster mobile: "Ao vivo" + tema + hambúrguer */}
                <div className="lg:hidden flex items-center gap-0.5 flex-shrink-0">
                    {live.enabled && (
                        <span className="hidden sm:flex items-center gap-1 text-xs text-green-300 mr-1" title={liveTitle}>
                            <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Ao vivo
                        </span>
                    )}
                    <ThemeToggle className="!w-11 !h-11" />
                    <div ref={menuRef} className="contents">
                        <button
                            ref={menuBtnRef}
                            type="button"
                            className="relative flex items-center justify-center w-11 h-11 rounded-lg hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label="Menu"
                            aria-expanded={menuOpen}
                            aria-controls={mobileMenuId}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                {menuOpen
                                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                }
                            </svg>
                            {live.enabled && (
                                <span aria-hidden="true" className="sm:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            )}
                        </button>

                        {/* Dropdown mobile: fora do fluxo (não altera --nav-h), rolável e limitado à altura da tela */}
                        {menuOpen && (
                            <div
                                id={mobileMenuId}
                                className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 bg-[#0B1220] border-b border-white/10 shadow-raised px-3 pb-3 pt-2 max-h-[calc(100dvh-var(--nav-h,56px))] overflow-y-auto overscroll-contain"
                            >
                                {ALL_LINKS.map(({ to, label }) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        onClick={() => setMenuOpen(false)}
                                        aria-current={isActive(to) ? "page" : undefined}
                                        className={`px-3 py-2.5 rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                                            isActive(to)
                                                ? "bg-white/10 text-white border-l-2 border-accent"
                                                : "text-slate-300 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        {label}
                                    </Link>
                                ))}

                                <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
                                    <div className="flex items-center gap-2">
                                        {fetchBtn(true)}
                                        {refreshBtn(true)}
                                    </div>
                                    {liveBtn(true)}
                                    {lastRunInfo(true)}
                                    {isAdmin ? (
                                        hasSession ? (
                                            <button
                                                type="button"
                                                onClick={() => { setMenuOpen(false); logout(); }}
                                                className={`${ctrlBase} w-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
                                            >
                                                <LockIcon />
                                                Admin — Sair
                                            </button>
                                        ) : null
                                    ) : (
                                        loginBtn(true)
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tema + autenticação (desktop) */}
                <div className="ml-auto hidden lg:flex items-center gap-3">
                    <ThemeToggle />
                    <span className="w-px h-4 bg-white/15 flex-shrink-0" />
                    {isAdmin ? (
                        <div className="relative" ref={adminRef}>
                            <button
                                ref={adminBtnRef}
                                type="button"
                                onClick={() => setAdminOpen((v) => !v)}
                                aria-haspopup="menu"
                                aria-expanded={adminOpen}
                                aria-controls={adminMenuId}
                                className={`${ctrlBase} ${ctrlSm} border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
                                title="Sessão de administrador ativa"
                            >
                                <LockIcon />
                                Admin
                                <svg
                                    width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                                    strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                                    className={`transition-transform duration-150 ${adminOpen ? "rotate-180" : ""}`}
                                >
                                    <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
                                </svg>
                            </button>
                            <div
                                id={adminMenuId}
                                role="menu"
                                aria-hidden={!adminOpen}
                                className={`absolute right-0 mt-2 w-52 bg-[#0B1220] border border-white/15 rounded-lg shadow-raised py-1 z-50 transition-opacity duration-100 ${
                                    adminOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                                }`}
                            >
                                <Link
                                    to="/admin"
                                    role="menuitem"
                                    onClick={() => setAdminOpen(false)}
                                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:bg-white/15"
                                >
                                    Painel administrativo
                                </Link>
                                {hasSession && expiryText && <div className="px-3 py-1.5 text-xs text-slate-400 border-t border-white/10">{expiryText}</div>}
                                {!hasSession && (
                                    <div className="px-3 py-1.5 text-xs text-slate-400 border-t border-white/10">
                                        Acesso liberado pelo servidor (sem login).
                                    </div>
                                )}
                                {hasSession && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setAdminOpen(false); logout(); }}
                                        className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:bg-white/15"
                                    >
                                        Sair
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        loginBtn()
                    )}
                </div>
            </div>

            {/* Segunda linha (desktop): clubes + controles globais */}
            <div className="hidden lg:flex items-center gap-3 mt-1">
                <div className="relative w-80">
                    <MultiClubPicker dense />
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {fetchBtn()}
                    {refreshBtn()}
                    {liveBtn()}
                    <span className="w-px h-4 bg-white/25 flex-shrink-0 mx-1" />
                    {lastRunInfo()}
                </div>
            </div>

            {error && (
                <div role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs bg-negative/20 rounded px-2 py-1 text-red-200">
                    ⚠️ {error}
                </div>
            )}
            {liveError && (
                <div role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs bg-negative/20 rounded px-2 py-1 text-red-200">
                    ⚠️ {liveError}
                </div>
            )}
            {!error && notice && (
                <div role="status" className="mt-1.5 flex items-center gap-1.5 text-xs bg-white/10 rounded px-2 py-1 text-slate-200">
                    ℹ️ {notice}
                </div>
            )}
        </nav>
    );
}
