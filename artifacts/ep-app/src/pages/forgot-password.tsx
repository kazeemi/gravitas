import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>
              Executive Presence
            </h1>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Reset your password</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="rounded border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
              <p className="font-medium">Check your email</p>
              <p className="mt-1">If an account with <span className="font-medium">{email}</span> exists, a password reset link has been sent.</p>
            </div>
            <p className="text-sm text-gray-500">Didn't receive it? Check your spam folder or try again.</p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/login")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>
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
                  autoFocus
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? "Sending..." : "Send reset link"}
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
