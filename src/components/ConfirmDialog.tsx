// src/components/ConfirmDialog.tsx
import React, { useEffect, useId, useRef } from "react";

type Props = {
    open: boolean;
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Estilo do botão de confirmação */
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

/**
 * Modal de confirmação simples (substitui window.confirm). Sem dependências.
 * - Escape / clique no fundo cancelam
 * - Foco inicial no botão "Cancelar" e Tab preso dentro do diálogo
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    busy = false,
    onConfirm,
    onCancel,
}: Props) {
    const titleId = useId();
    const descId = useId();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const onCancelRef = useRef(onCancel);
    onCancelRef.current = onCancel;
    const busyRef = useRef(busy);
    busyRef.current = busy;

    useEffect(() => {
        if (!open) return;
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        cancelRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                if (!busyRef.current) onCancelRef.current();
                return;
            }
            if (e.key === "Tab") {
                const first = cancelRef.current;
                const last = confirmRef.current;
                if (!first || !last) return;
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
            document.removeEventListener("keydown", onKey);
            previouslyFocused.current?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onMouseDown={(e) => {
                if (!busy && e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={message ? descId : undefined}
                className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-raised text-fg"
            >
                <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="inline-block w-1 h-5 rounded-sm bg-accent flex-shrink-0" />
                    <h2 id={titleId} className="font-display font-bold text-lg uppercase tracking-wide leading-none text-fg">
                        {title}
                    </h2>
                </div>
                {message && (
                    <p id={descId} className="mt-2 text-sm text-fg-muted">
                        {message}
                    </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? "Aguarde…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
