import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Gravitas
          </h1>
          <span className="rounded bg-[#FEF3E6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C84A18]">
            Beta
          </span>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="h-8 w-8 mx-auto rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
            <p className="text-sm text-gray-500">Verifying your email…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-5">
            <div className="rounded border border-green-200 bg-green-50 px-4 py-5">
              <p className="font-semibold text-green-800">Email verified</p>
              <p className="mt-1 text-sm text-green-700">Your account is active. Sign in to get started.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Sign in
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-5">
            <div className="rounded border border-red-200 bg-red-50 px-4 py-5">
              <p className="font-semibold text-red-800">Link expired or invalid</p>
              <p className="mt-1 text-sm text-red-700">
                This verification link has expired or already been used. Sign up again to receive a new one.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/signup")}>
              Back to sign up
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
