import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, setToken, clearToken, isAuthenticated } from "./api";
import { ConsentGate } from "@/components/consent-gate";

interface User {
  id: string;
  email: string;
  name: string | null;
  consentAcceptedAt?: string | null;
  roleTitle?: string | null;
  communicationContext?: string | null;
  goal?: string | null;
  onboardingCompleted?: boolean;
  hasSeenWelcome?: boolean;
  defaultRecordingContext?: string | null;
  emailSummaries?: boolean;
  totalRecordingSeconds?: number;
  recordingSecondsAllowance?: number;
  notifyOnUpgrade?: boolean;
  isAdmin?: boolean;
  interviewMode?: boolean | null;
  interviewSector?: string | null;
  interviewSectorCustom?: string | null;
  interviewCompanies?: string | null;
  educationLevel?: string | null;
  workExperienceYears?: string | null;
  primaryGoal?: string | null;
  interviewRole?: string | null;
  interviewTimeline?: string | null;
  interviewDate?: string | null;
  hasConfirmedInterview?: boolean | null;
  workEnvironment?: string | null;
  workCurrentRole?: string | null;
  workCurrentRoleCustom?: string | null;
  highStakesContexts?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, consentAccepted: boolean) => Promise<{ emailSent: boolean }>;
  loginWithGoogle: (credential: string) => Promise<{ isNewUser?: boolean }>;
  loginWithToken: (token: string, userData: User) => void;
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
        .then((u) => setUser(u as unknown as User))
        .catch(() => { clearToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    if ('error' in data && data.error === 'email_not_verified') {
      throw new Error(data.message as string || "Please verify your email before signing in.");
    }
    const { token, user: u } = data as { token: string; user: User };
    setToken(token);
    setUser(u as User);
  };

  const signup = async (email: string, password: string, name: string, consentAccepted: boolean) => {
    const result = await api.auth.signup(email, password, name, consentAccepted);
    // emailSent is false when the account was created but the verification
    // email could not be delivered. Older responses omit it; treat that as sent.
    return { emailSent: result.emailSent !== false };
  };

  const loginWithGoogle = async (credential: string) => {
    const result = await api.auth.google(credential);
    setToken(result.token);
    setUser(result.user as User);
    return { isNewUser: result.isNewUser };
  };

  const loginWithToken = (token: string, userData: User) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const u = await api.users.me();
    setUser(u as unknown as User);
  };

  // Only gate when we positively know consent is missing (null). An undefined field
  // means the endpoint didn't return it — gating on that would re-prompt users who
  // have already accepted.
  const needsConsent = !!user && user.consentAcceptedAt === null;

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, loginWithToken, logout, refreshUser }}>
      {children}
      {needsConsent && (
        <ConsentGate onAccepted={() => setUser(u => u ? { ...u, consentAcceptedAt: new Date().toISOString() } : u)} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
