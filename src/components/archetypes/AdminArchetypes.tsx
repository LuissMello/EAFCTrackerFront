import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import api from "../../services/api.ts";
import { API_ENDPOINTS } from "../../config/urls.ts";
import { Card, SectionHeader } from "../ui.tsx";
import { describeApiError } from "../../utils/apiError.ts";
import { clearApiResourceCache } from "../../hooks/useApiResource.ts";
import { fmtNum } from "../../utils/analyticsFormat.ts";
import ArchetypeBadge, { archetypeGroupLabel } from "./ArchetypeBadge.tsx";
import type { AdminArchetype, AdminArchetypeUpdate, ArchetypeGroup, ArchetypeRef } from "../../types/archetypes.ts";

const INPUT_CLS =
  "h-11 w-full rounded-lg border border-border bg-surface-sunken px-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-fg-subtle disabled:opacity-60 aria-[invalid=true]:border-negative";

const NAME_MAX = 40;
const SHORT_MAX = 8;
const GROUPS: ArchetypeGroup[] = ["ATAQUE", "MEIO", "DEFESA", "GOLEIRO"];

type Draft = { name: string; shortName: string; group: ArchetypeGroup | "" };
type RowStatus = { kind: "ok" | "error"; msg: string } | undefined;

const toDraft = (a: AdminArchetype): Draft => ({
  name: a.name ?? "",
  shortName: a.shortName ?? "",
  group: a.positionGroup ?? "",
});

function validate(d: Draft): string | null {
  if (d.name.trim().length > NAME_MAX) return `O nome pode ter no máximo ${NAME_MAX} caracteres.`;
  if (d.shortName.trim().length > SHORT_MAX) return `A sigla pode ter no máximo ${SHORT_MAX} caracteres.`;
  return null;
}

/** Como o rótulo ficará para os usuários (mesma regra do backend: nome ?? "Arquétipo #id"). */
function previewRef(a: AdminArchetype, d: Draft): ArchetypeRef {
  const name = d.name.trim() || null;
  return {
    id: a.id,
    name,
    label: name ?? `Arquétipo #${a.id}`,
    shortName: d.shortName.trim() || null,
    positionGroup: d.group || a.inferredPositionGroup,
  };
}

function ArchetypeRow({
  item,
  draft,
  status,
  saving,
  onChange,
  onSave,
}: {
  item: AdminArchetype;
  draft: Draft;
  status: RowStatus;
  saving: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
}) {
  const base = toDraft(item);
  const dirty =
    draft.name.trim() !== base.name || draft.shortName.trim() !== base.shortName || draft.group !== base.group;
  const invalid = validate(draft);
  const id = `arch-${item.id}`;
  const msgId = `${id}-msg`;
  const inferred = archetypeGroupLabel(item.inferredPositionGroup);
  return (
    <li>
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && !invalid && !saving) onSave();
          }}
          aria-labelledby={`${id}-title`}
        >
          <fieldset disabled={saving} className="min-w-0 space-y-3">
            <legend className="sr-only">Arquétipo {item.id}</legend>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm font-semibold text-fg">#{item.id}</span>
                <span id={`${id}-title`} className="text-sm text-fg-secondary truncate">
                  Prévia: <ArchetypeBadge archetype={previewRef(item, draft)} emphasis />
                </span>
              </div>
              <div className="text-xs text-fg-muted">
                Grupo inferido: <strong className="text-fg-secondary">{inferred ?? "—"}</strong>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-fg-subtle">Jogos</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(item.matches)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Jogadores</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(item.players)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Overall médio</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(item.avgProOverall, 1)}</dd>
              </div>
            </dl>

            <p className="text-xs text-fg-muted">
              <span className="text-fg-subtle">Quem usa este id: </span>
              {item.topPlayers.length === 0
                ? "ninguém no período registrado."
                : item.topPlayers.map((p, i) => (
                    <React.Fragment key={p.playerEntityId}>
                      {i > 0 && ", "}
                      <Link to={`/player/${p.playerEntityId}`} className="font-medium text-fg-secondary hover:text-accent">
                        {p.name}
                      </Link>{" "}
                      <span className="text-fg-subtle">({fmtNum(p.matches)} {p.matches === 1 ? "jogo" : "jogos"})</span>
                    </React.Fragment>
                  ))}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_10rem] gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor={`${id}-name`} className="text-xs text-fg-muted">
                  Nome
                </label>
                <input
                  id={`${id}-name`}
                  type="text"
                  className={INPUT_CLS}
                  value={draft.name}
                  maxLength={NAME_MAX + 20}
                  placeholder={`Arquétipo #${item.id}`}
                  aria-invalid={draft.name.trim().length > NAME_MAX ? true : undefined}
                  aria-describedby={msgId}
                  onChange={(e) => onChange({ name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor={`${id}-short`} className="text-xs text-fg-muted">
                  Sigla
                </label>
                <input
                  id={`${id}-short`}
                  type="text"
                  className={INPUT_CLS}
                  value={draft.shortName}
                  maxLength={SHORT_MAX + 10}
                  placeholder="ex: MAE"
                  aria-invalid={draft.shortName.trim().length > SHORT_MAX ? true : undefined}
                  aria-describedby={msgId}
                  onChange={(e) => onChange({ shortName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor={`${id}-group`} className="text-xs text-fg-muted">
                  Grupo
                </label>
                <select
                  id={`${id}-group`}
                  className={INPUT_CLS}
                  value={draft.group}
                  onChange={(e) => onChange({ group: e.target.value as ArchetypeGroup | "" })}
                >
                  <option value="">{inferred ? `Inferido (${inferred})` : "Sem grupo"}</option>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {archetypeGroupLabel(g)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary min-h-[44px] px-5" disabled={saving || !dirty || !!invalid}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <p
                id={msgId}
                role={status?.kind === "error" || (dirty && invalid) ? "alert" : "status"}
                className={`text-xs min-h-[1rem] flex-1 min-w-[10rem] ${
                  status?.kind === "ok" && !dirty ? "text-positive-fg" : "text-negative-fg"
                }`}
              >
                {dirty && invalid ? invalid : status?.msg ?? ""}
              </p>
            </div>
          </fieldset>
        </form>
      </Card>
    </li>
  );
}

/** Editor do catálogo de arquétipos (Admin): ids observados nas partidas + nome/sigla/grupo editáveis. */
export default function AdminArchetypes({ showToast }: { showToast: (msg: string, kind?: "success" | "error") => void }) {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [items, setItems] = useState<AdminArchetype[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [status, setStatus] = useState<Record<number, RowStatus>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AdminArchetype[]>(API_ENDPOINTS.ADMIN_ARCHETYPES);
      if (!mountedRef.current) return;
      const list = (Array.isArray(res.data) ? res.data : []).map((a) => ({ ...a, topPlayers: a.topPlayers ?? [] }));
      list.sort((a, b) => a.id - b.id);
      setItems(list);
      setDrafts(Object.fromEntries(list.map((a) => [a.id, toDraft(a)])));
      setStatus({});
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const info = describeApiError(e, "Não foi possível carregar os arquétipos.");
      if (info.status !== 401) setError(info.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unnamed = useMemo(() => items.filter((a) => !a.name).length, [items]);

  const save = async (item: AdminArchetype) => {
    const d = drafts[item.id] ?? toDraft(item);
    if (validate(d)) return;
    const body: AdminArchetypeUpdate = {
      name: d.name.trim() || null,
      shortName: d.shortName.trim() || null,
      positionGroup: d.group || null,
    };
    setSavingId(item.id);
    setStatus((s) => ({ ...s, [item.id]: undefined }));
    try {
      const res = await api.put<Partial<AdminArchetype> | null>(API_ENDPOINTS.ADMIN_ARCHETYPE(item.id), body);
      if (!mountedRef.current) return;
      const fromServer = res.data && typeof res.data === "object" && res.data.id === item.id ? res.data : {};
      const saved: AdminArchetype = {
        ...item,
        ...fromServer,
        topPlayers: (fromServer as Partial<AdminArchetype>).topPlayers ?? item.topPlayers,
        name: body.name,
        shortName: body.shortName,
        positionGroup: body.positionGroup,
      };
      setItems((list) => list.map((x) => (x.id === item.id ? saved : x)));
      setDrafts((m) => ({ ...m, [item.id]: toDraft(saved) }));
      setStatus((s) => ({ ...s, [item.id]: { kind: "ok", msg: "Salvo!" } }));
      clearApiResourceCache(); // rótulos aparecem em várias telas públicas (cache de 60 s)
      showToast(`Arquétipo #${item.id} salvo${body.name ? ` como "${body.name}"` : ""}.`);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const info = describeApiError(e, "Erro ao salvar o arquétipo.");
      if (info.status === 401) return; // o AuthProvider pede o login de novo
      const msg =
        info.status === 403
          ? "Somente leitura: o servidor não aceita alterações agora."
          : info.message;
      setStatus((s) => ({ ...s, [item.id]: { kind: "error", msg } }));
      showToast(`Arquétipo #${item.id}: ${msg}`, "error");
    } finally {
      if (mountedRef.current) setSavingId(null);
    }
  };

  return (
    <section aria-labelledby="admin-archetypes-title">
      <SectionHeader titleId="admin-archetypes-title" title="Arquétipos" className="mb-4" />

      <div
        role="note"
        className="mb-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-fg-secondary"
      >
        <Info size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-fg-muted" />
        <p>
          A EA envia só o <strong>id</strong> do arquétipo de cada jogador, nunca o nome. Aqui estão todos os ids já vistos nas
          partidas: use "Quem usa este id" e o overall para descobrir qual é qual e dê um nome. Ids sem nome aparecem no site como{" "}
          <strong>"Arquétipo #id"</strong>. Se o grupo ficar em branco, vale o inferido pela posição mais usada.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 p-3 bg-negative-soft border border-negative/40 text-negative-fg rounded text-sm flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading && items.length === 0 && !error && (
        <div role="status" className="text-sm text-fg-muted">
          Carregando arquétipos…
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="p-4 text-sm text-fg-muted">Nenhum arquétipo observado ainda. Eles aparecem depois da próxima busca de partidas.</Card>
      )}

      {items.length > 0 && (
        <>
          <p className="mb-3 text-xs text-fg-muted" aria-live="polite">
            {items.length} {items.length === 1 ? "id" : "ids"} · {unnamed} sem nome
          </p>
          <ul className="space-y-3">
            {items.map((a) => (
              <ArchetypeRow
                key={a.id}
                item={a}
                draft={drafts[a.id] ?? toDraft(a)}
                status={status[a.id]}
                saving={savingId === a.id}
                onChange={(patch) => {
                  setDrafts((m) => ({ ...m, [a.id]: { ...(m[a.id] ?? toDraft(a)), ...patch } }));
                  setStatus((s) => ({ ...s, [a.id]: undefined }));
                }}
                onSave={() => save(a)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
