import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAuthToken, type QuotaStatus } from "../api/client";

interface User {
  id: number;
  email: string;
  displayName: string;
  planTier: string;
}

interface AuthContextValue {
  user: User | null;
  quota: QuotaStatus | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data.user as User);
      setQuota(data.quota);
    } catch {
      setUser(null);
      setQuota(null);
      setAuthToken(null);
      localStorage.removeItem("careerai_token");
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("careerai_token");
    if (token) {
      setAuthToken(token);
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshMe]);

  async function login(email: string, password: string) {
    const data = await api.login(email.trim(), password);
    setAuthToken(data.token);
    localStorage.setItem("careerai_token", data.token);
    await refreshMe();
  }

  async function register(email: string, password: string, displayName: string) {
    const data = await api.register(email.trim(), password, displayName);
    setAuthToken(data.token);
    localStorage.setItem("careerai_token", data.token);
    await refreshMe();
  }

  function logout() {
    setAuthToken(null);
    localStorage.removeItem("careerai_token");
    setUser(null);
    setQuota(null);
  }

  return (
    <AuthContext.Provider value={{ user, quota, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
