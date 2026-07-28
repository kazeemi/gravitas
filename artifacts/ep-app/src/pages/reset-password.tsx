import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Gravitas
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Executive Presence, Elevated.</p>
          <p className="text-xs text-muted-foreground">Choose a new password</p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="rounded border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
              <p className="font-medium">Password updated</p>
              <p className="mt-1">You can now sign in with your new password.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-400">At least 8 characters</p>
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              <button onClick={() => setLocation("/login")} className="font-medium text-gray-900 underline">
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
