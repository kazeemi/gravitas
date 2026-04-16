import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, setToken, clearToken, isAuthenticated } from "./api";

interface User {
  id: string;
  email: string;
  name: string | null;
  roleTitle?: string | null;
  communicationContext?: string | null;
  goal?: string | null;
  onboardingCompleted?: boolean;
  defaultRecordingContext?: string | null;
  emailSummaries?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<{ isNewUser?: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      api.users.me()
        .then((u) => setUser(u as User))
        .catch(() => { clearToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: u } = await api.auth.login(email, password);
    setToken(token);
    setUser(u as User);
  };

  const signup = async (email: string, password: string, name: string) => {
    const { token, user: u } = await api.auth.signup(email, password, name);
    setToken(token);
    setUser(u as User);
  };

  const loginWithGoogle = async (credential: string) => {
    const result = await api.auth.google(credential);
    setToken(result.token);
    setUser(result.user as User);
    return { isNewUser: result.isNewUser };
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const u = await api.users.me();
    setUser(u as User);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
