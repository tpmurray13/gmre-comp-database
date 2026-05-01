import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, BarChart2, PlusCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <svg
              width="32" height="32" viewBox="0 0 32 32" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="GMRE logo"
              className="shrink-0"
            >
              <rect width="32" height="32" rx="6" fill="var(--color-navy)" />
              <path d="M8 16.5 C8 11.5 11.5 8 16.5 8 C19.5 8 22 9.5 23.5 12 L20.5 12 C19.5 10.5 18 9.8 16.5 9.8 C12.5 9.8 10 12.8 10 16.5 C10 20.2 12.5 23.2 16.5 23.2 C18.8 23.2 20.8 22 22 20 L22 18 L16 18 L16 16 L24 16 L24 24 L22 24 L22 22 C20.5 23.8 18.7 25 16.5 25 C11.5 25 8 21.5 8 16.5 Z" fill="white" />
            </svg>
            <div className="leading-none">
              <div className="text-sm font-bold font-display text-foreground tracking-tight">GMRE</div>
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Comp Database</div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                data-testid="nav-dashboard"
              >
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            <Link href="/submit">
              <Button
                variant={location === "/submit" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                data-testid="nav-submit"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Submit Comp</span>
              </Button>
            </Link>
          </nav>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-testid="btn-theme-toggle"
            className="shrink-0"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>Grant Murray Real Estate · Fayetteville, NC</span>
          </div>
          <span className="hidden sm:block">CCIM · SIOR</span>
        </div>
      </footer>
    </div>
  );
}
