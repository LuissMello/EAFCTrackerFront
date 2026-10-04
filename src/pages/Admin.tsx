import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { GameVersionBadge } from "../components/GameVersionBadge.tsx";
import { useClub } from "../hooks/useClub.tsx";
import { MSG_LOGIN_REQUIRED, useAuth } from "../hooks/useAuth.tsx";
import { gameVersionLabel, useGameVersions } from "../hooks/useGameVersions.tsx";
import type { GameVersion } from "../hooks/useGameVersions.tsx";
import { fmtBRFromISO } from "../utils/date.ts";
import { Card, PageHeader, PageShell, SectionHeader } from "../components/ui.tsx";
import { clearApiResourceCache } from "../hooks/useApiResource.ts";

/** Campo de texto/número no padrão "Broadcast" (claro/escuro) */
const INPUT_CLS =
  "h-9 rounded-lg border border-border bg-surface-sunken px-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-fg-subtle disabled:opacity-60";

interface AppSetting {
  key: string;
  value: string;
}

interface TrackedClub {
  clubId: number;
  name: string | null;
  addedAt: string;
  gameVersion: number | null;
  gameVersionName: string | null;
  timeZoneId: string;
  sessionGapMinutes: number;
}

interface ClubSearchResult {
  clubId: number;
  name: string | null;
  currentDivision: string | null;
  alreadyTracked: boolean;
}

interface SettingMeta {
  label: string;
  min: number;
  max?: number;
}

const SETTING_META: Record<string, SettingMeta> = {
  fetch_interval_minutes: { label: "Intervalo de busca (minutos)", min: 1, max: 1440 },
  max_parallel_fetches: { label: "Buscas em paralelo", min: 1, max: 8 },
  live_interval_minutes: { label: "Intervalo no modo ao vivo (minutos)", min: 1, max: 60 },
  goal_link_window_minutes: { label: "Janela para vincular registro à partida (minutos)", min: 30, max: 2880 },
  goal_registration_expire_days: { label: "Dias até expirar registros sem partida", min: 1, max: 60 },
};

function metaFor(key: string): SettingMeta {
  return SETTING_META[key] ?? { label: key, min: 1 };
}

/** Valida um inteiro dentro do intervalo da configuração. Retorna a mensagem de erro (ou null). */
function validateSetting(key: string, raw: string | undefined): string | null {
  const { min, max } = metaFor(key);
  const v = (raw ?? "").trim();
  if (!v) return "Informe um valor.";
  if (!/^\d+$/.test(v)) return "Use apenas números inteiros.";
  const n = parseInt(v, 10);
  if (n < min || (max !== undefined && n > max)) {
    return max !== undefined ? `Valor deve estar entre ${min} e ${max}.` : `Valor mínimo: ${min}.`;
  }
  return null;
}

function httpStatus(e: any): number | undefined {
  return e?.response?.status;
}

type Toast = { msg: string; kind: "success" | "error" } | null;

/* ======================================================
   Página (exige login de administrador)
====================================================== */
export default function Admin() {
  const { isAdmin, checking, logout, openLogin } = useAuth();

  // Ao abrir /admin sem sessão, já mostra o modal de login (uma vez). Perdas de sessão posteriores
  // (401/expiração) são tratadas pelo próprio AuthProvider, com a mensagem apropriada.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (checking || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (!isAdmin) openLogin(MSG_LOGIN_REQUIRED);
  }, [checking, isAdmin, openLogin]);

  if (checking) {
    return (
      <PageShell size="sm">
        <PageHeader eyebrow="Painel" title="Administração" />
        <div role="status" className="text-sm text-fg-muted">Verificando sessão…</div>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell size="sm">
        <PageHeader eyebrow="Painel" title="Administração" />
        <section aria-labelledby="admin-restricted-title">
        <Card className="p-6 text-center space-y-3">
          <div aria-hidden="true" className="mx-auto w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <h2 id="admin-restricted-title" className="font-display font-bold text-2xl uppercase tracking-wide leading-none text-fg">Área restrita</h2>
          <p className="text-sm text-fg-muted">
            A administração do sistema (clubes rastreados, versões do jogo e configurações) exige login de administrador.
            O restante do site continua público.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => openLogin()}>
            Entrar
          </button>
        </Card>
        </section>
      </PageShell>
    );
  }

  return <AdminPanel onSignOut={logout} />;
}

/* ======================================================
   Painel (somente com sessão de administrador)
====================================================== */
function AdminPanel({ onSignOut }: { onSignOut: () => void }) {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ----- Toast simples -----
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((msg: string, kind: "success" | "error" = "success") => {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ----- Configurações -----
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [settingsStatus, setSettingsStatus] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const statusTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = statusTimers.current;
    return () => Object.values(timers).forEach((t) => clearTimeout(t));
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await api.get<AppSetting[]>(API_ENDPOINTS.ADMIN_SETTINGS);
      if (!mountedRef.current) return;
      const data = Array.isArray(res.data) ? res.data : [];
      setSettings(data);
      const vals: Record<string, string> = {};
      data.forEach((s) => (vals[s.key] = s.value));
      setEditValues(vals);
    } catch (e: any) {
      if (!mountedRef.current || httpStatus(e) === 401) return;
      setSettingsError("Não foi possível carregar as configurações.");
    } finally {
      if (mountedRef.current) setSettingsLoading(false);
    }
  }, []);

  // ----- Clubes rastreados -----
  const [clubs, setClubs] = useState<TrackedClub[]>([]);
  const [newClubId, setNewClubId] = useState("");
  const [newClubName, setNewClubName] = useState("");
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [savingSessionClub, setSavingSessionClub] = useState<number | null>(null);

  async function saveSessionSettings(clubId: number, form: HTMLFormElement) {
    const values = new FormData(form);
    const timeZoneId = String(values.get("timeZoneId") ?? "").trim();
    const gapMinutes = Number(values.get("gapMinutes"));
    if (!timeZoneId || !Number.isInteger(gapMinutes) || gapMinutes < 15 || gapMinutes > 360) {
      showToast("Informe um fuso válido e intervalo entre 15 e 360 minutos.", "error");
      return;
    }
    setSavingSessionClub(clubId);
    try {
      await api.put(API_ENDPOINTS.ADMIN_SESSION_SETTINGS(clubId), { timeZoneId, gapMinutes });
      clearApiResourceCache(); // noites/laboratório/retrospectiva dependem do reagrupamento
      await loadClubs();
      showToast("Configuração das sessões salva.");
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Erro ao salvar sessões.", "error");
    } finally {
      setSavingSessionClub(null);
    }
  }

  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ClubSearchResult[] | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [pendingRemove, setPendingRemove] = useState<TrackedClub | null>(null);
  const [removing, setRemoving] = useState(false);

  // Mantém o seletor de clubes do cabeçalho em sincronia com o que foi rastreado/removido aqui
  const { reloadClubs } = useClub();

  // ----- Versões do jogo -----
  // Novos clubes e partidas entram sempre na versão atual (o backend usa a marcada como "atual").
  const { versions, currentVersion, loading: versionsLoading, error: versionsLoadError, reload: reloadVersions } =
    useGameVersions();

  const [pendingCurrent, setPendingCurrent] = useState<GameVersion | null>(null);
  const [settingCurrent, setSettingCurrent] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState("");
  const [newVersionName, setNewVersionName] = useState("");
  const [addingVersion, setAddingVersion] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    setClubsLoading(true);
    setClubsError(null);
    try {
      const res = await api.get<TrackedClub[]>(API_ENDPOINTS.ADMIN_TRACKED_CLUBS);
      if (mountedRef.current) setClubs(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      if (mountedRef.current && httpStatus(e) !== 401) setClubsError("Erro ao carregar clubes.");
    } finally {
      if (mountedRef.current) setClubsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadClubs();
  }, [loadSettings, loadClubs]);

  async function saveSetting(key: string) {
    const err = validateSetting(key, editValues[key]);
    if (err) {
      setSettingsStatus((s) => ({ ...s, [key]: err }));
      return;
    }
    const value = (editValues[key] ?? "").trim();
    setSavingKey(key);
    try {
      await api.put(API_ENDPOINTS.ADMIN_SETTING(key), { value });
      if (!mountedRef.current) return;
      // Atualiza somente esta chave (não sobrescreve edições não salvas das outras)
      setSettings((list) => list.map((s) => (s.key === key ? { ...s, value } : s)));
      setEditValues((v) => ({ ...v, [key]: value }));
      setSettingsStatus((s) => ({ ...s, [key]: "Salvo!" }));
      showToast(`${metaFor(key).label}: salvo.`);
      if (statusTimers.current[key]) clearTimeout(statusTimers.current[key]);
      statusTimers.current[key] = setTimeout(() => {
        if (mountedRef.current) setSettingsStatus((s) => ({ ...s, [key]: "" }));
      }, 2500);
    } catch (e: any) {
      if (!mountedRef.current || httpStatus(e) === 401) return;
      setSettingsStatus((s) => ({ ...s, [key]: "Erro ao salvar." }));
    } finally {
      if (mountedRef.current) setSavingKey(null);
    }
  }

  async function trackClub(clubId: number, name: string | null) {
    setClubsError(null);
    try {
      await api.post(API_ENDPOINTS.ADMIN_TRACKED_CLUBS, { clubId, name });
      loadClubs();
      reloadClubs();
      showToast(
        `${name ?? `Clube ${clubId}`} adicionado ao tracking${currentVersion !== null ? ` (${gameVersionLabel(currentVersion)})` : ""}.`
      );
      return true;
    } catch (e: any) {
      if (httpStatus(e) !== 401) setClubsError("Erro ao adicionar clube.");
      return false;
    }
  }

  async function addClub() {
    const id = parseInt(newClubId, 10);
    if (isNaN(id) || id <= 0) return;
    if (await trackClub(id, newClubName.trim() || null)) {
      setNewClubId("");
      setNewClubName("");
    }
  }

  async function searchClub() {
    const term = searchName.trim();
    if (!term) return;
    setSearching(true);
    setSearchMessage(null);
    setSearchResults(null);
    setClubsError(null);
    try {
      const res = await api.get<ClubSearchResult[]>(API_ENDPOINTS.ADMIN_CLUB_SEARCH(term));
      const found = res.data;
      if (found.length === 0) {
        setSearchMessage(`Nenhum clube encontrado para "${term}".`);
        return;
      }
      const exact = found.filter((c) => c.name?.toLowerCase() === term.toLowerCase());
      const single = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null;
      if (single) {
        if (single.alreadyTracked) {
          setSearchMessage(`${single.name ?? single.clubId} já está sendo rastreado.`);
        } else if (await trackClub(single.clubId, single.name)) {
          setSearchMessage(`${single.name ?? single.clubId} (ID ${single.clubId}) adicionado ao tracking.`);
          setSearchName("");
        }
        return;
      }
      setSearchResults(found);
    } catch (e: any) {
      if (httpStatus(e) !== 401) setClubsError("Erro ao buscar clube na EA. Tente novamente.");
    } finally {
      if (mountedRef.current) setSearching(false);
    }
  }

  async function addFromResult(c: ClubSearchResult) {
    if (await trackClub(c.clubId, c.name)) {
      setSearchResults((list) => list?.map((x) => (x.clubId === c.clubId ? { ...x, alreadyTracked: true } : x)) ?? null);
    }
  }

  const cancelSetCurrent = useCallback(() => setPendingCurrent(null), []);

  async function confirmSetCurrent() {
    if (!pendingCurrent) return;
    const target = pendingCurrent;
    setSettingCurrent(true);
    setVersionsError(null);
    try {
      await api.put(API_ENDPOINTS.ADMIN_GAME_VERSION_CURRENT(target.version), {});
      reloadVersions();
      if (mountedRef.current) showToast(`${gameVersionLabel(target.version)} agora é a versão atual.`);
    } catch (e: any) {
      if (mountedRef.current && httpStatus(e) !== 401) setVersionsError("Erro ao definir a versão atual.");
    } finally {
      if (mountedRef.current) {
        setSettingCurrent(false);
        setPendingCurrent(null);
      }
    }
  }

  async function addVersionSubmit() {
    const raw = newVersionNumber.trim();
    setVersionsError(null);
    if (!/^\d+$/.test(raw)) {
      setVersionsError("Informe o número da versão (ex.: 27).");
      return;
    }
    const n = parseInt(raw, 10);
    if (n < 20 || n > 99) {
      setVersionsError("A versão deve estar entre 20 e 99.");
      return;
    }
    if (versions.some((v) => v.version === n)) {
      setVersionsError(`A versão ${gameVersionLabel(n)} já existe.`);
      return;
    }
    setAddingVersion(true);
    try {
      const name = newVersionName.trim();
      await api.post(API_ENDPOINTS.ADMIN_GAME_VERSIONS, { version: n, ...(name ? { name } : {}) });
      reloadVersions();
      if (!mountedRef.current) return;
      setNewVersionNumber("");
      setNewVersionName("");
      showToast(`Versão ${gameVersionLabel(n)} adicionada.`);
    } catch (e: any) {
      if (!mountedRef.current) return;
      const st = httpStatus(e);
      if (st === 409) setVersionsError(`A versão ${gameVersionLabel(n)} já existe.`);
      else if (st !== 401) setVersionsError("Erro ao adicionar a versão.");
    } finally {
      if (mountedRef.current) setAddingVersion(false);
    }
  }

  const cancelRemove = useCallback(() => setPendingRemove(null), []);

  async function confirmRemove() {
    if (!pendingRemove) return;
    const target = pendingRemove;
    setRemoving(true);
    try {
      await api.delete(API_ENDPOINTS.ADMIN_TRACKED_CLUB(target.clubId));
      reloadClubs();
      if (!mountedRef.current) return;
      showToast(`${target.name ?? `Clube ${target.clubId}`} removido do tracking.`);
      loadClubs();
    } catch (e: any) {
      if (mountedRef.current && httpStatus(e) !== 401) setClubsError("Erro ao remover clube.");
    } finally {
      if (mountedRef.current) {
        setRemoving(false);
        setPendingRemove(null);
      }
    }
  }

  return (
    <PageShell size="md" className="space-y-10">
      <PageHeader
        eyebrow="Painel"
        title="Administração"
        className="mb-0"
        actions={
          <button type="button" onClick={onSignOut} className="btn btn-secondary px-3 py-1.5">
            Sair
          </button>
        }
      />

      {/* Configurações */}
      <section aria-labelledby="admin-settings-title">
        <SectionHeader titleId="admin-settings-title" title="Configurações do sistema" className="mb-4" />

        {settingsLoading && settings.length === 0 && (
          <div role="status" className="text-sm text-fg-muted">Carregando…</div>
        )}

        {settingsError && (
          <div role="alert" className="mb-3 p-3 bg-negative-soft border border-negative/40 text-negative-fg rounded text-sm flex items-center justify-between gap-3">
            <span>{settingsError}</span>
            <button type="button" className="btn btn-secondary" onClick={loadSettings} disabled={settingsLoading}>
              Tentar novamente
            </button>
          </div>
        )}

        {settings.length > 0 && (
          <Card className="divide-y overflow-hidden">
            {settings.map((s) => {
              const meta = metaFor(s.key);
              const inputId = `setting-${s.key}`;
              const msgId = `${inputId}-msg`;
              const value = editValues[s.key] ?? s.value;
              const validation = validateSetting(s.key, value);
              const status = settingsStatus[s.key];
              const dirty = value.trim() !== s.value;
              const hint = meta.max !== undefined ? `${meta.min}–${meta.max}` : `mín. ${meta.min}`;
              return (
                <div key={s.key} className="px-4 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label htmlFor={inputId} className="flex-1 min-w-[180px] text-sm text-fg-secondary">
                      {meta.label}
                      <span className="ml-2 text-xs text-fg-subtle">({hint})</span>
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min={meta.min}
                      max={meta.max}
                      step={1}
                      className={`${INPUT_CLS} w-24 text-right ${validation && dirty ? "border-negative" : ""}`}
                      value={value}
                      aria-invalid={validation && dirty ? true : undefined}
                      aria-describedby={msgId}
                      onChange={(e) => {
                        setEditValues((v) => ({ ...v, [s.key]: e.target.value }));
                        setSettingsStatus((st) => ({ ...st, [s.key]: "" }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSetting(s.key);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveSetting(s.key)}
                      disabled={savingKey === s.key || !dirty || !!validation}
                      className="btn btn-primary"
                    >
                      {savingKey === s.key ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                  <p
                    id={msgId}
                    role={status && status !== "Salvo!" ? "alert" : "status"}
                    className={`mt-1 text-xs min-h-[1rem] ${
                      status === "Salvo!" ? "text-positive" : "text-negative"
                    }`}
                  >
                    {status || (dirty && validation ? validation : "")}
                  </p>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Clubes rastreados */}
      <section aria-labelledby="admin-clubs-title">
        <SectionHeader titleId="admin-clubs-title" title="Clubes rastreados" className="mb-4" />

        {clubsError && (
          <div role="alert" className="mb-3 p-2 bg-negative-soft border border-negative/40 text-negative-fg rounded text-sm">
            {clubsError}
          </div>
        )}

        <Card className="mb-4 overflow-hidden">
          {clubsLoading ? (
            <div className="p-4 text-sm text-fg-muted">Carregando...</div>
          ) : clubs.length === 0 ? (
            <div className="p-4 text-sm text-fg-muted">Nenhum clube cadastrado.</div>
          ) : (
            <ul className="divide-y">
              {clubs.map((c) => (
                <li key={c.clubId} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-fg w-24">{c.clubId}</span>
                  <span className="flex-1 text-sm text-fg-muted flex items-center gap-2 min-w-0">
                    <span className="truncate">{c.name ?? <em className="text-fg-subtle">sem nome</em>}</span>
                    <GameVersionBadge version={c.gameVersion} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingRemove(c)}
                    aria-label={`Remover ${c.name ?? `clube ${c.clubId}`} do tracking`}
                    className="px-2 py-1 rounded-lg border border-negative/40 text-negative hover:bg-negative-soft text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-negative"
                  >
                    Remover
                  </button>
                  </div>
                  <details className="mt-2 text-xs text-fg-muted">
                    <summary className="cursor-pointer">Configurar sessões de jogo</summary>
                    <form className="flex flex-wrap items-end gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); saveSessionSettings(c.clubId, e.currentTarget); }}>
                      <label className="flex flex-col gap-1">Fuso horário (IANA)
                        <input name="timeZoneId" defaultValue={c.timeZoneId ?? "America/Sao_Paulo"} required maxLength={100} className={`${INPUT_CLS} w-52`} list="club-time-zones" />
                      </label>
                      <label className="flex flex-col gap-1">Intervalo máximo entre partidas (min)
                        <input name="gapMinutes" type="number" min={15} max={360} required defaultValue={c.sessionGapMinutes ?? 120} className={`${INPUT_CLS} w-36`} />
                      </label>
                      <button type="submit" disabled={savingSessionClub === c.clubId} className="btn btn-secondary px-3">{savingSessionClub === c.clubId ? "Salvando…" : "Salvar"}</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <datalist id="club-time-zones"><option value="America/Sao_Paulo" /><option value="America/New_York" /><option value="Europe/Lisbon" /><option value="Europe/London" /><option value="UTC" /></datalist>

        <form
          className="flex gap-2 items-end flex-wrap mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            searchClub();
          }}
        >
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label htmlFor="admin-search-name" className="text-xs text-fg-muted">
              Buscar clube pelo nome na EA
            </label>
            <input
              id="admin-search-name"
              type="text"
              placeholder="ex: Trash As Well"
              className={INPUT_CLS}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          <button type="submit" disabled={!searchName.trim() || searching} className="btn btn-primary px-4">
            {searching ? "Buscando..." : "Buscar e adicionar"}
          </button>
        </form>

        {searchMessage && (
          <div role="status" className="mb-3 p-2 bg-accent/10 border border-accent/30 text-fg-secondary rounded text-sm">
            {searchMessage}
          </div>
        )}

        {searchResults && (
          <Card className="mb-4 overflow-hidden">
            <div className="px-4 py-2 text-xs text-fg-muted border-b">
              Vários clubes encontrados. Escolha qual adicionar
              {currentVersion !== null ? ` (entra como ${gameVersionLabel(currentVersion)})` : ""}:
            </div>
            <ul className="divide-y">
              {searchResults.map((c) => (
                <li key={c.clubId} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm text-fg">
                    {c.name ?? "sem nome"}
                    <span className="ml-2 font-mono text-xs text-fg-muted">ID {c.clubId}</span>
                    {c.currentDivision && <span className="ml-2 text-xs text-fg-muted">Div. {c.currentDivision}</span>}
                  </span>
                  {c.alreadyTracked ? (
                    <span className="text-xs text-positive-fg">Rastreado</span>
                  ) : (
                    <button type="button" onClick={() => addFromResult(c)} className="btn btn-primary px-3 py-1 text-xs">
                      Adicionar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted mb-2">Adicionar manualmente pelo ID</summary>
          <form
            className="flex gap-2 items-end flex-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              addClub();
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="admin-new-club-id" className="text-xs text-fg-muted">
                Club ID *
              </label>
              <input
                id="admin-new-club-id"
                type="number"
                min={1}
                placeholder="ex: 355651"
                className={`${INPUT_CLS} w-36`}
                value={newClubId}
                onChange={(e) => setNewClubId(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="admin-new-club-name" className="text-xs text-fg-muted">
                Nome (opcional)
              </label>
              <input
                id="admin-new-club-name"
                type="text"
                placeholder="ex: BratnavaFC"
                className={`${INPUT_CLS} w-44`}
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
              />
            </div>
            <button type="submit" disabled={!newClubId} className="btn btn-primary px-4">
              Adicionar
            </button>
          </form>
        </details>
      </section>

      {/* Versões do jogo */}
      <section aria-labelledby="admin-versions-title">
        <SectionHeader titleId="admin-versions-title" title="Versão do jogo" className="mb-4" />

        <p className="mb-3 text-sm text-fg-muted">
          Versão atual: <strong className="text-fg">{currentVersion !== null ? gameVersionLabel(currentVersion) : "—"}</strong>.
          Novos clubes e partidas entram nessa versão automaticamente.
        </p>

        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted mb-3">
            Trocar a versão atual ou cadastrar uma nova (ex.: quando sair o FC28)
          </summary>

        {(versionsError || versionsLoadError) && (
          <div role="alert" className="mb-3 p-2 bg-negative-soft border border-negative/40 text-negative-fg rounded text-sm">
            {versionsError ?? versionsLoadError}
          </div>
        )}

        <Card className="mb-4 overflow-hidden">
          {versionsLoading && versions.length === 0 ? (
            <div className="p-4 text-sm text-fg-muted">Carregando...</div>
          ) : versions.length === 0 ? (
            <div className="p-4 text-sm text-fg-muted">Nenhuma versão cadastrada.</div>
          ) : (
            <ul className="divide-y">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-16 font-mono text-sm text-fg">{gameVersionLabel(v.version)}</span>
                  <span className="flex-1 text-sm text-fg-muted min-w-0 truncate">
                    {v.name ?? <em className="text-fg-subtle">sem nome</em>}
                    {v.startsAt && <span className="ml-2 text-xs text-fg-subtle">desde {fmtBRFromISO(v.startsAt)}</span>}
                  </span>
                  {v.isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-positive/40 bg-positive-soft text-positive-fg text-xs">
                      Atual
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary px-2 py-1 text-xs"
                      onClick={() => setPendingCurrent(v)}
                      aria-label={`Tornar ${gameVersionLabel(v.version)} a versão atual`}
                    >
                      Tornar atual
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <form
          className="flex gap-2 items-end flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            addVersionSubmit();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-new-version" className="text-xs text-fg-muted">
              Número da versão * (20–99)
            </label>
            <input
              id="admin-new-version"
              type="number"
              inputMode="numeric"
              min={20}
              max={99}
              step={1}
              placeholder="ex: 27"
              className={`${INPUT_CLS} w-36`}
              value={newVersionNumber}
              onChange={(e) => setNewVersionNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label htmlFor="admin-new-version-name" className="text-xs text-fg-muted">
              Nome (opcional)
            </label>
            <input
              id="admin-new-version-name"
              type="text"
              placeholder="ex: EA Sports FC 27"
              className={INPUT_CLS}
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
            />
          </div>
          <button type="submit" disabled={!newVersionNumber.trim() || addingVersion} className="btn btn-primary px-4">
            {addingVersion ? "Adicionando..." : "Adicionar versão"}
          </button>
        </form>
        </details>
      </section>

      <ConfirmDialog
        open={pendingCurrent !== null}
        title="Tornar esta versão a atual?"
        message={
          pendingCurrent
            ? `${gameVersionLabel(pendingCurrent.version)} passará a ser a versão atual (padrão para novos clubes rastreados). Os clubes já rastreados mantêm a versão que têm.`
            : undefined
        }
        confirmLabel="Tornar atual"
        busy={settingCurrent}
        onConfirm={confirmSetCurrent}
        onCancel={cancelSetCurrent}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remover clube do tracking?"
        message={
          pendingRemove
            ? `${pendingRemove.name ?? "Clube"} (ID ${pendingRemove.clubId}) deixará de ser rastreado.`
            : undefined
        }
        confirmLabel="Remover"
        danger
        busy={removing}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
      />

      {/* Toast */}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 pointer-events-none">
        {toast && (
          <div
            role="status"
            className={`pointer-events-auto rounded-lg border border-border-strong border-l-4 bg-surface-raised px-4 py-2 text-sm text-fg shadow-raised ${
              toast.kind === "success" ? "border-l-positive" : "border-l-negative"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </PageShell>
  );
}
