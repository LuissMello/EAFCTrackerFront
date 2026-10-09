import api from "./api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import type { GoalBody, GoalLine, GoalRegistration, GoalRegistrationRequest } from "../types/goalRegistration.ts";

export function toGoalBody(line: GoalLine): GoalBody {
  return {
    scorerPlayerEntityId: line.scorerPlayerEntityId,
    assistPlayerEntityId: line.assistPlayerEntityId,
    // pré-assistência só existe com assistência
    preAssistPlayerEntityId: line.assistPlayerEntityId !== null ? line.preAssistPlayerEntityId : null,
  };
}

/** POST /api/goal-registrations → 201 (registro vazio, "em andamento"). */
export async function createGoalRegistration(body: GoalRegistrationRequest): Promise<GoalRegistration> {
  const { data } = await api.post<GoalRegistration>(API_ENDPOINTS.GOAL_REGISTRATIONS, body);
  return data;
}

/** GET /api/goal-registrations/{id}. */
export async function getGoalRegistration(id: number, signal?: AbortSignal): Promise<GoalRegistration> {
  const { data } = await api.get<GoalRegistration>(API_ENDPOINTS.GOAL_REGISTRATION(id), { signal });
  return data;
}

/** GET /api/goal-registrations/current?clubId= → registro em andamento ou null (204). */
export async function getCurrentGoalRegistration(clubId: number, signal?: AbortSignal): Promise<GoalRegistration | null> {
  const res = await api.get<GoalRegistration | "">(API_ENDPOINTS.GOAL_REG_CURRENT(clubId), { signal });
  if (res.status === 204 || !res.data || typeof res.data !== "object") return null;
  return res.data;
}

/** POST …/{id}/goals → registro completo atualizado (o gol novo entra no fim). */
export async function addGoal(id: number, line: GoalLine): Promise<GoalRegistration> {
  const { data } = await api.post<GoalRegistration>(API_ENDPOINTS.GOAL_REG_GOALS(id), toGoalBody(line));
  return data;
}

/** PUT …/{id}/goals/{goalId}. */
export async function updateGoal(id: number, goalId: number, line: GoalLine): Promise<GoalRegistration> {
  const { data } = await api.put<GoalRegistration>(API_ENDPOINTS.GOAL_REG_GOAL(id, goalId), toGoalBody(line));
  return data;
}

/** DELETE …/{id}/goals/{goalId} → registro completo (200). */
export async function deleteGoal(id: number, goalId: number): Promise<GoalRegistration> {
  const { data } = await api.delete<GoalRegistration>(API_ENDPOINTS.GOAL_REG_GOAL(id, goalId));
  return data;
}

/** DELETE /api/goal-registrations/{id} → 204 (cancela o registro). */
export async function deleteGoalRegistration(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.GOAL_REGISTRATION(id));
}

/** Aceita corpo com o registro; sem corpo (204) relê o registro. */
async function registrationFrom(id: number, data: unknown): Promise<GoalRegistration> {
  if (data && typeof data === "object" && "id" in (data as object)) return data as GoalRegistration;
  return getGoalRegistration(id);
}

/** POST …/{id}/finish: marca a partida como finalizada (continua aguardando o vínculo). */
export async function finishGoalRegistration(id: number): Promise<GoalRegistration> {
  const { data } = await api.post(API_ENDPOINTS.GOAL_REG_FINISH(id));
  return registrationFrom(id, data);
}

/** POST …/{id}/reopen: reabre enquanto a partida não foi vinculada. */
export async function reopenGoalRegistration(id: number): Promise<GoalRegistration> {
  const { data } = await api.post(API_ENDPOINTS.GOAL_REG_REOPEN(id));
  return registrationFrom(id, data);
}

/** POST …/{id}/confirm-suggestion: vincula à partida sugerida. */
export async function confirmGoalRegistrationSuggestion(id: number): Promise<GoalRegistration> {
  const { data } = await api.post(API_ENDPOINTS.GOAL_REG_CONFIRM_SUGGESTION(id));
  return registrationFrom(id, data);
}

/** POST …/{id}/dismiss-suggestion: descarta a sugestão ("não é essa"). */
export async function dismissGoalRegistrationSuggestion(id: number): Promise<GoalRegistration> {
  const { data } = await api.post(API_ENDPOINTS.GOAL_REG_DISMISS_SUGGESTION(id));
  return registrationFrom(id, data);
}

/** PUT /api/goal-registrations/{id}: troca o adversário de um registro ainda não vinculado. */
export async function changeGoalRegistrationOpponent(id: number, opponent: { opponentClubId: number; opponentName: string }): Promise<GoalRegistration> {
  const { data } = await api.put(API_ENDPOINTS.GOAL_REGISTRATION(id), opponent);
  return registrationFrom(id, data);
}
