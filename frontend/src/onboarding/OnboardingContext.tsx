import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";

const KEY = "konphlux.onboarded.v1";

type OnboardingValue = {
  onboarded: boolean | null; // null = still loading from storage
  complete: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const v = await storage.getItem<string>(KEY, "");
      setOnboarded(v === "1");
    })();
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({
      onboarded,
      complete: async () => {
        await storage.setItem(KEY, "1");
        setOnboarded(true);
      },
    }),
    [onboarded],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
