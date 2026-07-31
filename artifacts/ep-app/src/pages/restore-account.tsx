import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getRecordHref } from "@/lib/baseline";
import { Button } from "@/components/ui/button";

type State = "loading" | "success" | "expired" | "error";

export default function RestoreAccountPage() {
  const [state, setState] = useState<State>("loading");
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const { loginWithToken, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }

    fetch("/api/v1/auth/restore-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          const msg: string = data.error ?? "";
          setState(msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("deleted") ? "expired" : "error");
          return;
        }
        loginWithToken(data.token, data.user);
        setState("success");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF7F2] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <h1
            className="text-2xl font-semibold text-[#0F1B2D]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Gravitas
          </h1>
        </div>

        {state === "loading" && (
          <div className="space-y-3">
            <div className="h-8 w-8 mx-auto rounded-full border-4 border-gray-200 border-t-[#C84A18] animate-spin" />
            <p className="text-sm text-gray-500">Restoring your account…</p>
          </div>
        )}

        {state === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 space-y-4">
            <p className="text-xl font-semibold text-green-800">Welcome back.</p>
            <p className="text-sm text-green-700">
              Your account has been fully restored. All your sessions and progress are exactly as you left them.
            </p>
            <Button
              onClick={() => setLocation(getRecordHref(user))}
              className="w-full mt-2"
              style={{ background: "linear-gradient(120deg,#F0953E 0%,#C84A18 100%)" }}
            >
              Go to Gravitas
            </Button>
          </div>
        )}

        {state === "expired" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 space-y-3">
            <p className="text-lg font-semibold text-red-800">This link has expired</p>
            <p className="text-sm text-red-700 leading-relaxed">
              The 30-day restore window has passed and your account has been permanently deleted. We're sorry — this action cannot be undone.
            </p>
            <p className="text-xs text-red-600 mt-2">
              If you believe this is an error, contact us at{" "}
              <a href="mailto:info@selfcraftpartners.com" className="underline">info@selfcraftpartners.com</a>.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 space-y-3">
            <p className="text-lg font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-700">
              This restore link is invalid or has already been used. If you need help, contact{" "}
              <a href="mailto:info@selfcraftpartners.com" className="underline">info@selfcraftpartners.com</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
