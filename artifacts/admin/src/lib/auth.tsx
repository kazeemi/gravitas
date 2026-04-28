import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, user: AdminUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const raw = localStorage.getItem("admin_user");
    if (token && raw) {
      try {
        const user = JSON.parse(raw) as AdminUser;
        setState({ user, token, loading: false });
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setState({ user: null, token: null, loading: false });
      }
    } else {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const setAuth = (token: string, user: AdminUser) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_user", JSON.stringify(user));
    setState({ user, token, loading: false });
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setState({ user: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
