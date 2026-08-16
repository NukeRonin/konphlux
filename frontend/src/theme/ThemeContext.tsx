import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { darkColors, lightColors, ThemeColors } from "./tokens";

type Mode = "light" | "dark";

type ThemeContextValue = {
  mode: Mode;
  colors: ThemeColors;
  toggle: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "konphlux.theme.mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<Mode>(STORAGE_KEY, "light");
      if (saved === "light" || saved === "dark") setMode(saved);
      setReady(true);
    })();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      ready,
      toggle: () => {
        setMode((prev) => {
          const next = prev === "dark" ? "light" : "dark";
          storage.setItem(STORAGE_KEY, next);
          return next;
        });
      },
    }),
    [mode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
