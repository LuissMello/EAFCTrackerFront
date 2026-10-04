import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { PageHeader, PageShell, Skeleton } from "../components/ui.tsx";
import { ClubSelect, EmptyPanel, NoClubPanel } from "../components/analytics/Controls.tsx";
import { SelectField } from "../components/match/SelectField.tsx";
import LabFiltersBar, { type LabPreset } from "../components/lab/LabFiltersBar.tsx";
import PlayersTab from "../components/lab/PlayersTab.tsx";
import { FormationTab, OpponentTab, WhenTab } from "../components/lab/ContextTabs.tsx";
import DuosTab from "../components/lab/DuosTab.tsx";
import { METRIC_OPTIONS, type LabMetric } from "../components/lab/labShared.tsx";
import { useAnalyticsClub } from "../hooks/useAnalyticsClub.ts";
import { useGameVersions } from "../hooks/useGameVersions.tsx";
import { useLabContext, useLabDuos, useLabPlayerImpact } from "../hooks/useLab.ts";
import type { LabFilters } from "../types/lab";
import { daysAgoYmd } from "../utils/date.ts";

type TabId = "players" | "when" | "formation" | "opponent" | "duos";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "players", label: "Jogadores" },
  { id: "when", label: "Quando jogamos" },
  { id: "formation", label: "Formação" },
  { id: "opponent", label: "Adversário" },
  { id: "duos", label: "Duplas" },
];

const DEFAULT_FILTERS: LabFilters = { from: "", to: "", gameVersion: null, minMatches: 3 };

export default function Laboratorio() {
  const { options, active, pick, clubsLoading } = useAnalyticsClub();
  const { versions, currentVersion } = useGameVersions();
  const clubId = active?.clubId ?? null;

  const [filters, setFilters] = useState<LabFilters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<TabId>("players");
  const [ctxMetric, setCtxMetric] = useState<LabMetric>("win");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  const fetchClubId = invalidRange ? null : clubId;

  const impact = useLabPlayerImpact(fetchClubId, filters, tab === "players");
  const ctxEnabled = tab === "when" || tab === "formation" || tab === "opponent";
  const context = useLabContext(fetchClubId, filters, ctxEnabled);
  const duos = useLabDuos(fetchClubId, filters, tab === "duos");

  // Rótulo do preset derivado dos filtros (sem estado duplicado)
  const preset = useMemo<LabPreset>(() => {
    const { from, to, gameVersion } = filters;
    if (!from && !to && gameVersion === null) return "all";
    if (!from && !to && gameVersion !== null && gameVersion === currentVersion) return "version";
    if (from && !to && gameVersion === null) {
      if (from === daysAgoYmd(30)) return "30";
      if (from === daysAgoYmd(90)) return "90";
    }
    return "custom";
  }, [filters, currentVersion]);

  const onPreset = useCallback(
    (p: Exclude<LabPreset, "custom">) => {
      setFilters((f) => {
        if (p === "all") return { ...f, from: "", to: "", gameVersion: null };
        if (p === "version") return { ...f, from: "", to: "", gameVersion: currentVersion };
        return { ...f, from: daysAgoYmd(p === "30" ? 30 : 90), to: "", gameVersion: null };
      });
    },
    [currentVersion]
  );
  const onCustomDate = useCallback((key: "from" | "to", value: string) => setFilters((f) => ({ ...f, [key]: value })), []);
  const onVersion = useCallback((v: number | null) => setFilters((f) => ({ ...f, gameVersion: v })), []);
  const onMinMatches = useCallback((n: number) => setFilters((f) => ({ ...f, minMatches: n })), []);

  const onTabKey = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  if (!active) {
    if (clubsLoading) {
      return (
        <PageShell className="space-y-4" aria-busy>
          <PageHeader title="Laboratório com e sem" className="mb-0" />
          <Skeleton className="h-32 rounded-2xl" />
        </PageShell>
      );
    }
    return <NoClubPanel what="o laboratório" title="Laboratório com e sem" />;
  }

  return (
    <PageShell className="space-y-4">
      <PageHeader
        eyebrow={active.name}
        title="Laboratório com e sem"
        className="mb-0"
        actions={<ClubSelect options={options} value={clubId} onChange={pick} />}
      />

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2.5 text-sm text-gold-fg"
      >
        <FlaskConical size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
        <p>
          <strong>Correlação, não causa:</strong> poucas partidas distorcem os números. Compare sempre com o desempenho geral
          do time e leia com cautela os recortes marcados como "amostra pequena".
        </p>
      </div>

      <LabFiltersBar
        filters={filters}
        preset={preset}
        versions={versions}
        currentVersion={currentVersion}
        onPreset={onPreset}
        onCustomDate={onCustomDate}
        onVersion={onVersion}
        onMinMatches={onMinMatches}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Análises do laboratório"
          className="flex gap-1 overflow-x-auto scroll-touch-x rounded-xl border border-border bg-surface p-1 max-w-full"
        >
          {TABS.map((t, i) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`lab-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`lab-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`flex-shrink-0 px-3 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? "bg-accent text-accent-fg" : "text-fg-secondary hover:bg-surface-sunken"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {(tab === "when" || tab === "formation" || tab === "opponent") && (
          <SelectField label="Métrica" value={ctxMetric} onChange={(e) => setCtxMetric(e.target.value as LabMetric)}>
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <div role="tabpanel" id={`lab-panel-${tab}`} aria-labelledby={`lab-tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
        {invalidRange ? (
          <EmptyPanel icon="📅" title="Período inválido" message="A data inicial precisa ser anterior (ou igual) à data final." />
        ) : (
          <>
            {tab === "players" && (
              <PlayersTab
                data={impact.data}
                loading={impact.loading}
                error={impact.error}
                onRetry={impact.reload}
                minMatches={filters.minMatches}
              />
            )}
            {tab === "when" && (
              <WhenTab data={context.data} loading={context.loading} error={context.error} onRetry={context.reload} metric={ctxMetric} />
            )}
            {tab === "formation" && (
              <FormationTab data={context.data} loading={context.loading} error={context.error} onRetry={context.reload} metric={ctxMetric} />
            )}
            {tab === "opponent" && (
              <OpponentTab data={context.data} loading={context.loading} error={context.error} onRetry={context.reload} metric={ctxMetric} />
            )}
            {tab === "duos" && <DuosTab data={duos.data} loading={duos.loading} error={duos.error} onRetry={duos.reload} />}
          </>
        )}
      </div>
    </PageShell>
  );
}
