import { AuthButton } from "@/features/auth/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm">
          <div className="flex items-center gap-6 font-semibold">
            <Link href="/">BoardTenZorg</Link>
            <Link
              href="/"
              className="text-xs font-medium uppercase text-muted-foreground hover:text-foreground"
            >
              Leaderboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
