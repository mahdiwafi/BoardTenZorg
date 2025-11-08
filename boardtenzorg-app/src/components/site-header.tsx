import Link from "next/link";

import { AuthButton } from "@/features/auth/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  requiresAuth?: boolean;
};

type SiteHeaderProps = {
  seasonLabel?: string | null;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  className?: string;
};

const baseNavItems: NavItem[] = [
  { label: "Leaderboard", href: "/" },
  { label: "History", href: "/profile/history", requiresAuth: true },
  { label: "Tournaments", href: "/tournaments" },
];

const adminNavItem: NavItem = {
  label: "Admin Dashboard",
  href: "/admin",
  requiresAuth: true,
};

export function SiteHeader({
  seasonLabel,
  isAuthenticated = false,
  isAdmin = false,
  className,
}: SiteHeaderProps) {
  const navItems = isAdmin
    ? [...baseNavItems, adminNavItem]
    : baseNavItems;

  return (
    <header
      className={cn(
        "border-b border-border/70 bg-background/90 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 text-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-base font-semibold tracking-wide text-foreground"
            >
              BoardTenZorg
            </Link>
            <span className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {seasonLabel ? `Season ${seasonLabel}` : "Season pending"}
            </span>
          </div>
          <nav className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
            {navItems.map((item) => {
              const href =
                item.requiresAuth && !isAuthenticated
                  ? `/auth/login?redirect=${encodeURIComponent(item.href)}`
                  : item.href;

              return (
                <Link
                  key={item.label}
                  href={href}
                  className="rounded-full px-3 py-1 transition hover:bg-muted/60 hover:text-foreground"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

