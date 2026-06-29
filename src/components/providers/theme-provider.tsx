"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeSetting = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeSetting | undefined;
  setTheme: (theme: ThemeSetting) => void;
  resolvedTheme: ResolvedTheme | undefined;
  systemTheme: ResolvedTheme | undefined;
  themes: ThemeSetting[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: ThemeSetting): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeSetting;
  storageKey?: string;
  enableSystem?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeSetting | undefined>(undefined);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | undefined>(
    undefined,
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme | undefined>(
    undefined,
  );

  useEffect(() => {
    let stored: ThemeSetting = defaultTheme;
    try {
      const value = localStorage.getItem(storageKey);
      if (value === "light" || value === "dark" || value === "system") {
        stored = value;
      }
    } catch {
      // ignore localStorage errors
    }

    setThemeState(stored);
    setSystemTheme(getSystemTheme());
    setResolvedTheme(resolveTheme(stored));
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (setting: ThemeSetting) => {
      const resolved = resolveTheme(setting);
      setResolvedTheme(resolved);
      setSystemTheme(media.matches ? "dark" : "light");
      root.classList.toggle("dark", resolved === "dark");
    };

    apply(theme);

    const onChange = () => {
      setSystemTheme(media.matches ? "dark" : "light");
      if (theme === "system") apply("system");
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    (value: ThemeSetting) => {
      setThemeState(value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // ignore localStorage errors
      }
    },
    [storageKey],
  );

  const themes = useMemo<ThemeSetting[]>(
    () =>
      enableSystem
        ? ["light", "dark", "system"]
        : ["light", "dark"],
    [enableSystem],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
      themes,
    }),
    [theme, setTheme, resolvedTheme, systemTheme, themes],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: undefined,
      setTheme: () => undefined,
      resolvedTheme: undefined,
      systemTheme: undefined,
      themes: ["light", "dark", "system"],
    };
  }
  return context;
}
