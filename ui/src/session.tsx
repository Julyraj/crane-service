import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CatalogResponse, User } from "@crane/shared";
import { api, getToken, setToken } from "./api.ts";
import { disconnectRealtime } from "./realtime.ts";

interface SessionValue {
  user: User | null;
  loading: boolean;
  catalog: CatalogResponse | null;
  signIn(token: string, user: User): void;
  signOut(): Promise<void>;
  setUser(user: User): void;
  reloadCatalog(): void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);

  const reloadCatalog = useCallback(() => {
    api<CatalogResponse>("/catalog").then(setCatalog).catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    reloadCatalog();
    if (!getToken()) return;
    api<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [reloadCatalog]);

  const signIn = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    disconnectRealtime();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, catalog, signIn, signOut, setUser, reloadCatalog }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside provider");
  return v;
}
