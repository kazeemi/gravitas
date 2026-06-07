import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/gravitas-logo-light.png" alt="Gravitas" className="h-8 w-auto" />
            <span
              className="text-2xl font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Gravitas
            </span>
            <span className="rounded bg-[#FEF3E6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C84A18]">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Executive Presence, Elevated.</p>
          <p className="text-xs text-muted-foreground">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-3 text-center text-sm">
          <button onClick={() => setLocation("/forgot-password")} className="text-gray-500 hover:text-gray-700 underline">
            Forgot password?
          </button>
        </p>
        <p className="mt-3 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <button onClick={() => setLocation("/signup")} className="font-medium text-gray-900 underline">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
