// src/utils/apiError.ts

/** Resultado normalizado de um erro de API (axios) para exibição em pt-BR. */
export interface ApiErrorInfo {
  status?: number;
  message: string;
  /** Segundos sugeridos pelo servidor (Retry-After) em respostas 429. */
  retryAfterSec?: number;
}

const BY_STATUS: Record<number, string> = {
  400: "Os dados enviados não são válidos. Confira e tente novamente.",
  404: "Não encontrado. Pode ter sido removido; atualize a página.",
  409: "Esta ação não é possível no estado atual do registro.",
  429: "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.",
  500: "Erro no servidor. Tente novamente em instantes.",
  502: "Servidor indisponível. Tente novamente em instantes.",
  503: "Servidor indisponível. Tente novamente em instantes.",
};

function firstValidationMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  for (const v of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Extrai a mensagem de um erro do axios: usa `detail`/`title` do ProblemDetails quando vier,
 * senão um texto padrão por status (400/409/429…) ou de rede.
 */
export function describeApiError(e: unknown, fallback: string): ApiErrorInfo {
  const err = e as any;
  const status: number | undefined = err?.response?.status;
  if (status === undefined) {
    return { message: err?.request ? "Sem conexão com o servidor. Verifique sua internet e tente novamente." : fallback };
  }
  const data = err?.response?.data;
  let message: string | null = null;
  if (typeof data === "string" && data.trim() && data.length < 300 && !data.trim().startsWith("<")) {
    message = data.trim();
  } else if (data && typeof data === "object") {
    const detail = typeof data.detail === "string" ? data.detail.trim() : "";
    const title = typeof data.title === "string" ? data.title.trim() : "";
    message = detail || firstValidationMessage(data.errors) || title || null;
  }
  const info: ApiErrorInfo = { status, message: message ?? BY_STATUS[status] ?? fallback };
  if (status === 429) {
    const raw = err?.response?.headers?.["retry-after"];
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      info.retryAfterSec = Math.ceil(n);
      info.message = `${info.message} Tente novamente em ${info.retryAfterSec} s.`;
    }
  }
  return info;
}
