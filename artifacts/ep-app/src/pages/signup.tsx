import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MailCheckIcon, MailWarningIcon } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!consentAccepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue");
      return;
    }
    setLoading(true);
    try {
      const result = await signup(email, password, name, consentAccepted);
      setEmailSent(result.emailSent);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            {/* Decorative: the wordmark beside it already names the product. */}
            <img src="/gravitas-logo-light.png" alt="" className="h-8 w-auto" />
            <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Gravitas
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Executive Presence, Elevated.</p>
          {!done && <p className="text-xs text-muted-foreground">Create your account</p>}
        </div>

        {done ? (
          <div
            className="rounded-2xl border px-6 py-7 text-center space-y-3"
            style={
              emailSent
                ? { backgroundColor: "#EDF4EF", borderColor: "rgba(107,155,122,0.35)" }
                : { backgroundColor: "#FAF0E8", borderColor: "rgba(192,90,30,0.35)" }
            }
          >
            <div
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: emailSent ? "#6B9B7A" : "#C05A1E" }}
            >
              {emailSent ? (
                <MailCheckIcon className="h-5 w-5 text-white" />
              ) : (
                <MailWarningIcon className="h-5 w-5 text-white" />
              )}
            </div>
            <p
              className="text-xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
            >
              {emailSent ? "Check your inbox" : "Your account is created"}
            </p>
            {emailSent ? (
              <p className="text-sm leading-relaxed" style={{ color: "rgba(15,27,45,0.75)" }}>
                We've sent a verification link to{" "}
                <strong style={{ color: "#0F1B2D" }}>{email}</strong>. Click it to activate your account.
              </p>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "rgba(15,27,45,0.75)" }}>
                We could not send the verification email to{" "}
                <strong style={{ color: "#0F1B2D" }}>{email}</strong> just now. Nothing is lost — your
                account exists. Email{" "}
                <a
                  href="mailto:kanza@selfcraftpartners.com"
                  className="underline hover:no-underline font-medium"
                  style={{ color: "#C84A18" }}
                >
                  kanza@selfcraftpartners.com
                </a>{" "}
                and we will activate it for you.
              </p>
            )}
            <p className="text-xs pt-1" style={{ color: "rgba(15,27,45,0.55)" }}>
              {emailSent ? "Didn't receive it? Check your spam folder or " : "Or "}
              <button
                onClick={() => setDone(false)}
                className="underline hover:no-underline font-medium"
                style={{ color: "#C84A18" }}
              >
                try again
              </button>
              .
            </p>
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
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
              </div>
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
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-400">At least 8 characters</p>
              </div>
              <div className="flex items-start gap-3 pt-1">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                  className="mt-0.5 shrink-0"
                />
                <label htmlFor="consent" className="text-xs text-gray-600 leading-relaxed cursor-pointer">
                  I agree to Gravitas's{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
                    Privacy Policy
                  </a>
                  , including the processing of my voice and video recordings by AI services (OpenAI and Anthropic) to deliver coaching feedback.
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !consentAccepted}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <button onClick={() => setLocation("/login")} className="font-medium text-gray-900 underline">
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
