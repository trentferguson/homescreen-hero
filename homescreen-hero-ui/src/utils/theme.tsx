import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemeAccent = "default" | "plex-orange";

type ThemeContextValue = {
    theme: Theme;
    accent: ThemeAccent;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setAccent: (accent: ThemeAccent) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getStoredTheme(): Theme | null {
    const stored = localStorage.getItem("theme");
    return stored === "dark" || stored === "light" ? stored : null;
}

function getStoredAccent(): ThemeAccent {
    const stored = localStorage.getItem("accent");
    return stored === "plex-orange" ? stored : "default";
}

function getPreferredTheme(): Theme {
    const stored = getStoredTheme();
    if (stored) return stored;

    return "dark"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());
    const [accent, setAccent] = useState<ThemeAccent>(() => getStoredAccent());

    useEffect(() => {
        const root = document.documentElement;

        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }

        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        const root = document.documentElement;

        if (accent === "default") {
            root.removeAttribute("data-accent");
        } else {
            root.setAttribute("data-accent", accent);
        }

        localStorage.setItem("accent", accent);
    }, [accent]);

    const value = useMemo(
        () => ({
            theme,
            accent,
            setTheme,
            setAccent,
            toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
        }),
        [theme, accent],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}

// Returns the current primary color as a hex string for use in SVG/chart fills
// eslint-disable-next-line react-refresh/only-export-components
export function usePrimaryColor(): string {
    const { accent } = useTheme();
    return useMemo(() => {
        const rgb = getComputedStyle(document.documentElement)
            .getPropertyValue("--color-primary")
            .trim();
        const [r, g, b] = rgb.split(" ").map(Number);
        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    }, [accent]);
}
