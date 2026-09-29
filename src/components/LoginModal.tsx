import React, { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
    open: boolean;
    /** Mensagem contextual (ex.: sessão expirada) exibida acima do campo */
    message?: string | null;
    onClose: () => void;
    /** Deve rejeitar (erro axios) quando o login falhar; resolve quando concluído */
    onSubmit: (password: string) => Promise<void>;
};

/** Converte a falha do POST /api/auth/login em mensagem amigável (pt-BR). */
export function describeLoginError(e: any): string {
    const status: number | undefined = e?.response?.status;
    if (!e?.response) return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    if (status === 401) return "Senha inválida.";
    if (status === 429) {
        const raw = e.response.headers?.["retry-after"];
        const secs = Number(raw);
        if (Number.isFinite(secs) && secs > 0) {
            const mins = Math.max(1, Math.ceil(secs / 60));
            return `Muitas tentativas. Tente novamente em ${mins} min.`;
        }
        return "Muitas tentativas. Tente novamente em alguns minutos.";
    }
    if (status === 503) return "Login de administrador não configurado no servidor.";
    return `Não foi possível entrar (HTTP ${status ?? "?"}).`;
}

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal de login do administrador.
 * - role=dialog + aria-modal; foco inicial no campo de senha; Tab preso no diálogo
 * - Esc / clique no fundo fecham; Enter envia
 */
export default function LoginModal({ open, message, onClose, onSubmit }: Props) {
    const titleId = useId();
    const descId = useId();
    const errId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Ao abrir: guarda o foco anterior, foca a senha e trata Esc/Tab. Ao fechar: limpa e devolve o foco.
    useEffect(() => {
        if (!open) return;
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        setPassword("");
        setError(null);
        const t = setTimeout(() => inputRef.current?.focus(), 0);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key === "Tab" && dialogRef.current) {
                const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
                if (items.length === 0) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(t);
            document.removeEventListener("keydown", onKey);
            previouslyFocused.current?.focus?.();
        };
    }, [open]);

    const submit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (busy || !password) return;
            setBusy(true);
            setError(null);
            try {
                await onSubmit(password);
                if (mountedRef.current) setPassword("");
            } catch (err: any) {
                if (!mountedRef.current) return;
                setError(describeLoginError(err));
                setPassword("");
                inputRef.current?.focus();
            } finally {
                if (mountedRef.current) setBusy(false);
            }
        },
        [busy, password, onSubmit]
    );

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={message ? descId : undefined}
                className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-raised text-fg"
            >
                <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="inline-block w-1 h-5 rounded-sm bg-accent flex-shrink-0" />
                    <h2 id={titleId} className="font-display font-bold text-lg uppercase tracking-wide leading-none text-fg">
                        Entrar como administrador
                    </h2>
                </div>
                {message && (
                    <p id={descId} className="mt-2 text-sm text-fg-muted">
                        {message}
                    </p>
                )}

                <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
                    <div className="flex flex-col gap-1">
                        <label htmlFor={`${titleId}-pw`} className="text-sm font-medium text-fg-secondary">
                            Senha
                        </label>
                        <input
                            id={`${titleId}-pw`}
                            ref={inputRef}
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            className="h-10 rounded-lg border border-border bg-surface-sunken px-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={busy}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errId : undefined}
                        />
                    </div>

                    {error && (
                        <p id={errId} role="alert" className="text-sm text-negative-fg">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={busy || !password}>
                            {busy ? "Entrando…" : "Entrar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
