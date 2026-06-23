import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";

// ===== Tipos =====
export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextType = {
    /** Preferência salva do usuário */
    theme: ThemeChoice;
    /** Tema efetivamente aplicado (resolve "system") */
    resolvedTheme: ResolvedTheme;
    /** Define a preferência (light | dark | system) */
    setTheme: (t: ThemeChoice) => void;
    /** Alterna direto entre claro/escuro a partir do tema atual */
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = "theme";

function getStored(): ThemeChoice {
    if (typeof window === "undefined") return "system";
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemPrefersDark(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

function resolve(choice: ThemeChoice): ResolvedTheme {
    return choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice;
}

function applyResolved(r: ResolvedTheme) {
    const root = document.documentElement;
    root.classList.toggle("dark", r === "dark");
    root.style.colorScheme = r;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeChoice>(() => getStored());
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
        resolve(getStored())
    );

    // Aplica a classe + persiste sempre que a escolha mudar
    useEffect(() => {
        const r = resolve(theme);
        setResolvedTheme(r);
        applyResolved(r);
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    // Acompanha mudanças do SO apenas no modo "system"
    useEffect(() => {
        if (theme !== "system") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
            const r: ResolvedTheme = mq.matches ? "dark" : "light";
            setResolvedTheme(r);
            applyResolved(r);
        };
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [theme]);

    const setTheme = useCallback((t: ThemeChoice) => setThemeState(t), []);
    const toggleTheme = useCallback(
        () => setThemeState((prev) => (resolve(prev) === "dark" ? "light" : "dark")),
        []
    );

    const value = useMemo<ThemeContextType>(
        () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
        [theme, resolvedTheme, setTheme, toggleTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme deve ser usado dentro de um ThemeProvider");
    return ctx;
}
