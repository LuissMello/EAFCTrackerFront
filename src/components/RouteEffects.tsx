import React from "react";
import { useLocation } from "react-router-dom";
import { documentTitleFor } from "../config/routeMeta.ts";

const MAIN_ID = "conteudo";

/** Atalho "Ir para o conteúdo". Não usa href="#..." porque o app roda com HashRouter. */
export function SkipLink() {
    return (
        <a
            href={`#${MAIN_ID}`}
            onClick={(e) => {
                e.preventDefault();
                const main = document.getElementById(MAIN_ID);
                if (!main) return;
                main.focus({ preventScroll: true });
                main.scrollIntoView({ block: "start" });
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-fg focus:shadow-raised"
        >
            Ir para o conteúdo
        </a>
    );
}

/**
 * A cada mudança de rota (só do caminho — mudanças de query string não disparam):
 * rola ao topo, atualiza document.title e move o foco para o h1 da nova página (a11y).
 * As páginas são lazy, então o h1 pode aparecer depois: observa o <main> por alguns segundos.
 */
export function RouteEffects() {
    const { pathname } = useLocation();
    const first = React.useRef(true);

    React.useEffect(() => {
        document.title = documentTitleFor(pathname);
    }, [pathname]);

    React.useEffect(() => {
        // Primeira carga: não rouba o foco nem rola (o navegador já cuida disso).
        if (first.current) {
            first.current = false;
            return;
        }
        window.scrollTo(0, 0);

        const main = document.getElementById(MAIN_ID);
        if (!main) return;

        let done = false;
        let observer: MutationObserver | null = null;
        let timeout: ReturnType<typeof setTimeout> | undefined;

        const finish = () => {
            done = true;
            observer?.disconnect();
            if (timeout) clearTimeout(timeout);
        };
        const tryFocus = () => {
            if (done) return;
            // Se o usuário já colocou o foco em outro controle dentro da página, respeita.
            const active = document.activeElement;
            if (active && active !== document.body && main.contains(active) && active !== main) {
                finish();
                return;
            }
            const h1 = main.querySelector<HTMLElement>("h1");
            if (!h1) return;
            if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
            h1.focus({ preventScroll: true });
            finish();
        };

        tryFocus();
        if (!done) {
            observer = new MutationObserver(tryFocus);
            observer.observe(main, { childList: true, subtree: true });
            timeout = setTimeout(finish, 4000);
        }
        return finish;
    }, [pathname]);

    return null;
}
