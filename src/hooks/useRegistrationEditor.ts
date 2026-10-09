import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCanceled } from "../services/api.ts";
import { addGoal, deleteGoal, getGoalRegistration, updateGoal } from "../services/goalRegistrations.ts";
import { describeApiError } from "../utils/apiError.ts";
import type { DisplayGoal, GoalLine, GoalRegistration, RegistrationGoal } from "../types/goalRegistration.ts";

type OpKind = "add" | "edit" | "remove";

/** Operação pendente. Para "add", `target` é o id temporário (negativo) do gol ainda não criado. */
interface Op {
  id: number;
  kind: OpKind;
  target: number;
  line?: GoalLine;
  /** Preenchido quando o envio falhou por motivo transitório (rede/5xx/429): aguarda "tentar de novo". */
  failed?: string;
}

export type SaveState = "saved" | "saving" | "error";

const fromLine = (l: GoalLine) => ({
  scorerPlayerEntityId: l.scorerPlayerEntityId,
  scorerName: l.scorerName,
  assistPlayerEntityId: l.assistPlayerEntityId,
  assistName: l.assistName,
  preAssistPlayerEntityId: l.preAssistPlayerEntityId,
  preAssistName: l.preAssistName,
});

function baseKey(g: RegistrationGoal, i: number): number {
  return g.id ?? 1_000_000_000 + i;
}

/** Lista exibida = último estado confirmado + operações ainda pendentes (atualização otimista). */
function applyOps(base: RegistrationGoal[], ops: Op[]): DisplayGoal[] {
  let list: DisplayGoal[] = base.map((g, i) => ({ ...g, key: baseKey(g, i), pending: false }));
  for (const op of ops) {
    if (op.kind === "add" && op.line) {
      list = [...list, { id: op.target, key: op.target, order: list.length + 1, pending: true, failed: op.failed, ...fromLine(op.line) }];
    } else if (op.kind === "edit" && op.line) {
      const line = op.line;
      list = list.map((g) => (g.key === op.target ? { ...g, ...fromLine(line), pending: true, failed: op.failed } : g));
    } else if (op.kind === "remove") {
      list = op.failed
        ? list.map((g) => (g.key === op.target ? { ...g, failed: op.failed } : g))
        : list.filter((g) => g.key !== op.target);
    }
  }
  return list;
}

const isRetryable = (status?: number) => status === undefined || status >= 500 || status === 429 || status === 408;

/**
 * Estado de um registro em andamento com salvamento imediato por gol.
 * - As operações (adicionar/editar/remover) entram numa fila SERIALIZADA: nenhum toque é perdido e a ordem é mantida.
 * - A tela atualiza na hora (otimista). Erro de validação (400/404/409): reverte e mostra a mensagem.
 *   Erro transitório (rede/5xx/429): o gol continua visível, marcado como "não salvo", e a fila espera "tentar de novo".
 */
export function useRegistrationEditor(initial: GoalRegistration) {
  const registrationId = initial.id;
  const baseRef = useRef<GoalRegistration>(initial);
  const opsRef = useRef<Op[]>([]);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const opSeq = useRef(0);
  const tempSeq = useRef(0);
  const tempMap = useRef(new Map<number, number>());
  const version = useRef(0);
  const [view, setView] = useState<{ base: GoalRegistration; ops: Op[] }>({ base: initial, ops: [] });
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commit = useCallback(() => {
    if (mountedRef.current) setView({ base: baseRef.current, ops: opsRef.current });
  }, []);

  const resolveKey = useCallback((key: number): number => (key < 0 ? tempMap.current.get(key) ?? key : key), []);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const op = opsRef.current[0];
        if (!op || op.failed) break;
        const target = op.kind === "add" ? op.target : resolveKey(op.target);
        if (op.kind !== "add" && target < 0) {
          // dependia de um gol que não chegou a ser criado
          opsRef.current = opsRef.current.slice(1);
          commit();
          continue;
        }
        try {
          let res: GoalRegistration;
          if (op.kind === "add" && op.line) res = await addGoal(registrationId, op.line);
          else if (op.kind === "edit" && op.line) res = await updateGoal(registrationId, target, op.line);
          else res = await deleteGoal(registrationId, target);

          let rest = opsRef.current.slice(1);
          if (op.kind === "add") {
            const known = new Set(baseRef.current.goals.map((g) => g.id));
            const fresh = res.goals.filter((g) => !known.has(g.id));
            const created = fresh[fresh.length - 1] ?? res.goals[res.goals.length - 1];
            if (created?.id !== undefined) {
              tempMap.current.set(op.target, created.id);
              rest = rest.map((o) => (o.target === op.target ? { ...o, target: created.id as number } : o));
            }
          }
          opsRef.current = rest;
          baseRef.current = res;
          version.current++;
          commit();
        } catch (e) {
          if (isCanceled(e)) break;
          const info = describeApiError(e, "Não foi possível salvar o gol.");
          if (isRetryable(info.status)) {
            opsRef.current = [{ ...op, failed: info.message }, ...opsRef.current.slice(1)];
            commit();
            break;
          }
          // Rejeitado pelo servidor: reverte a atualização otimista e avisa
          opsRef.current = opsRef.current.slice(1).filter((o) => !(op.kind === "add" && o.target === op.target));
          if (mountedRef.current) setRejection(info.message);
          commit();
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [registrationId, commit, resolveKey]);

  const enqueue = useCallback(
    (op: Omit<Op, "id">) => {
      opsRef.current = [...opsRef.current, { ...op, id: ++opSeq.current }];
      setRejection(null);
      commit();
      void pump();
    },
    [commit, pump]
  );

  /** Adiciona um gol (aparece na hora). Devolve o id temporário (use `resolveKey` para obter o real depois). */
  const add = useCallback(
    (line: GoalLine): number => {
      const tempId = --tempSeq.current;
      enqueue({ kind: "add", target: tempId, line });
      return tempId;
    },
    [enqueue]
  );

  const edit = useCallback(
    (key: number, line: GoalLine) => {
      enqueue({ kind: "edit", target: resolveKey(key), line });
    },
    [enqueue, resolveKey]
  );

  const remove = useCallback(
    (key: number) => {
      enqueue({ kind: "remove", target: resolveKey(key) });
    },
    [enqueue, resolveKey]
  );

  /** Tenta de novo a operação que falhou (e segue com a fila). */
  const retry = useCallback(() => {
    const head = opsRef.current[0];
    if (!head?.failed) return;
    opsRef.current = [{ ...head, failed: undefined }, ...opsRef.current.slice(1)];
    commit();
    void pump();
  }, [commit, pump]);

  /** Descarta a operação que falhou (o gol "não salvo" some) e segue com a fila. */
  const discardFailed = useCallback(() => {
    const head = opsRef.current[0];
    if (!head?.failed) return;
    opsRef.current = opsRef.current.slice(1).filter((o) => !(head.kind === "add" && o.target === head.target));
    commit();
    void pump();
  }, [commit, pump]);

  /** Relê o registro do servidor (ex.: depois de a partida ser vinculada). Ignorado se há envios em andamento. */
  const refresh = useCallback(async () => {
    if (opsRef.current.length > 0 || runningRef.current) return;
    const v = version.current;
    try {
      const data = await getGoalRegistration(registrationId);
      if (!mountedRef.current || opsRef.current.length > 0 || runningRef.current || version.current !== v) return;
      baseRef.current = data;
      version.current++;
      commit();
    } catch {
      /* silencioso: mantém o último estado conhecido */
    }
  }, [registrationId, commit]);

  /** Troca o estado confirmado por um registro devolvido pelo servidor (finalizar, reabrir, trocar adversário, sugestão). */
  const applyServer = useCallback(
    (res: GoalRegistration) => {
      baseRef.current = res;
      version.current++;
      commit();
    },
    [commit]
  );

  const dismissRejection = useCallback(() => setRejection(null), []);

  const goals = useMemo(() => applyOps(view.base.goals ?? [], view.ops), [view]);
  const failedMessage = view.ops.find((o) => o.failed)?.failed ?? null;
  const saveState: SaveState = failedMessage ? "error" : view.ops.length > 0 ? "saving" : "saved";

  return {
    registration: view.base,
    goals,
    saveState,
    failedMessage,
    rejection,
    add,
    edit,
    remove,
    retry,
    discardFailed,
    refresh,
    applyServer,
    resolveKey,
    dismissRejection,
  };
}
