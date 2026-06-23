import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, ThemeChoice } from "../hooks/useTheme.tsx";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const META: Record<ThemeChoice, { icon: React.ReactNode; label: string }> = {
    system: { icon: <Monitor className="w-4 h-4" />, label: "Tema: sistema" },
    light: { icon: <Sun className="w-4 h-4" />, label: "Tema: claro" },
    dark: { icon: <Moon className="w-4 h-4" />, label: "Tema: escuro" },
};

/** Botão compacto que cicla sistema → claro → escuro. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
    const { theme, setTheme } = useTheme();
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            title={`${META[theme].label} — clique para ${META[next].label.toLowerCase()}`}
            aria-label={META[theme].label}
            className={`flex items-center justify-center w-8 h-8 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors ${className}`}
        >
            {META[theme].icon}
        </button>
    );
}
