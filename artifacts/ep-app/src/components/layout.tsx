import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboardIcon, MicIcon, TrendingUpIcon, SettingsIcon, LogOutIcon } from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { path: "/record", label: "Record", icon: MicIcon },
  { path: "/progress", label: "Progress", icon: TrendingUpIcon },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <nav className="hidden md:flex w-56 flex-col border-r border-border bg-sidebar px-3 py-6">
        <div className="mb-8 px-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <img
                src="/gravitas-logo-light.png"
                alt="Gravitas logo mark"
                className="h-7 w-auto"
              />
              <span
                className="text-xl font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Gravitas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground leading-tight">
                Executive Presence AI Coach
              </p>
              <span className="rounded bg-[#FEF3E6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C84A18]">
                Beta
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
        >
          <LogOutIcon className="h-4 w-4" />
          Sign out
        </button>
      </nav>
      <div className="flex flex-1 flex-col">
        <header className="flex md:hidden items-center justify-between border-b border-border bg-sidebar px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/gravitas-logo-light.png"
              alt="Gravitas logo mark"
              className="h-5 w-auto"
            />
            <span
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Gravitas
            </span>
            <span className="rounded bg-[#FEF3E6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C84A18]">
              Beta
            </span>
          </div>
          <button onClick={logout} className="text-xs text-muted-foreground">Sign out</button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>

        <nav className="flex md:hidden items-center justify-around border-t border-border bg-sidebar px-2 py-2">
          {navItems.slice(0, 4).map(item => {
            const Icon = item.icon;
            const active = location.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center gap-0.5 rounded px-2 py-1 text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
