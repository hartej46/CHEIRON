import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
    theme: ThemeMode;
    isDark: boolean;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "cheiron-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
    if (typeof window === "undefined") return "light";
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "dark" || stored === "light") return stored;
    } catch {
        // Ignore storage access errors
    }
    return "light";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Ignore storage write errors
        }
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    };

    const setTheme = (mode: ThemeMode) => {
        setThemeState(mode);
    };

    return (
        <ThemeContext.Provider
            value={{
                theme,
                isDark: theme === "dark",
                toggleTheme,
                setTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        return {
            theme: "light",
            isDark: false,
            toggleTheme: () => {},
            setTheme: () => {},
        };
    }
    return ctx;
}
