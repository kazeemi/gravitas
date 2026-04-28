import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  backHref?: string;
  backLabel?: string;
}

export default function Layout({ children, title, backHref, backLabel }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/users", label: "Users", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r bg-sidebar flex flex-col shrink-0">
        <div className="px-5 py-5 border-b">
          <span className="font-serif font-semibold text-lg text-foreground">Gravitas</span>
          <span className="ml-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === href
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-4 border-t pt-3">
          <div className="px-3 py-1.5 mb-2">
            <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <header className="border-b bg-background px-6 py-4 flex items-center gap-3">
          {backHref && (
            <Button variant="ghost" size="sm" onClick={() => navigate(backHref)} className="gap-1.5 -ml-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
              {backLabel ?? "Back"}
            </Button>
          )}
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </header>
        <div className="px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
