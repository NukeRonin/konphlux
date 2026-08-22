import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, ApiError, AuthUser, setAuthToken } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "konphlux.auth.token";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) {
        setAuthToken(token);
        try {
          const me = await api.me();
          setUser(me);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            setAuthToken(null);
            await storage.secureRemove(TOKEN_KEY);
          }
        }
      }
      setReady(true);
    })();
  }, []);

  const persist = async (token: string, u: AuthUser, remember: boolean) => {
    setAuthToken(token);
    if (remember) {
      // Securely store the session so the user stays signed in across app launches.
      await storage.secureSet(TOKEN_KEY, token);
    } else {
      // Session lives only for this run — clear any previously saved token so the
      // user is prompted to log in again next time they open the app.
      await storage.secureRemove(TOKEN_KEY);
    }
    setUser(u);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      signIn: async (email, password, remember = true) => {
        const res = await api.login(email, password);
        await persist(res.access_token, res.user, remember);
      },
      signUp: async (email, password, displayName, remember = true) => {
        const res = await api.register(email, password, displayName);
        await persist(res.access_token, res.user, remember);
      },
      signOut: async () => {
        setAuthToken(null);
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
