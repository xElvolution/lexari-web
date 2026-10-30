import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { clearSession, loadSession, saveSession, type SavedSession } from "@/lib/session";

type SessionState = {
  ready: boolean;
  token: string | null;
  wallet: string | null;
  accept: (session: SavedSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then((s) => {
      if (s) { setToken(s.token); setWallet(s.wallet || null); }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const accept = async (session: SavedSession) => {
    await saveSession(session);
    setToken(session.token);
    setWallet(session.wallet || null);
  };

  const signOut = async () => {
    if (token) await api("/api/auth/signout", { method: "POST" }, token).catch(() => {});
    await clearSession();
    setToken(null);
    setWallet(null);
  };

  return <Ctx.Provider value={{ ready, token, wallet, accept, signOut }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("Session missing");
  return v;
}
