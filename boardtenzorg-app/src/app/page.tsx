import Link from "next/link";

import { AuthButton } from "@/features/auth/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getLeaderboard,
  getSeasonById,
} from "@/lib/boardtenzorg";

const LEADERBOARD_LIMIT = 50;

function formatSeasonLabel(startAt: string | null, seasonId: string) {
  if (!startAt) {
    return seasonId;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    });
    return formatter.format(new Date(startAt));
  } catch {
    return seasonId;
  }
}

export default async function LeaderboardPage() {
  const [profile, seasonId] = await Promise.all([
    getCurrentUserProfile(),
    getActiveSeasonId(),
  ]);

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const leaderboard = seasonId
    ? await getLeaderboard(seasonId, {
        limit: LEADERBOARD_LIMIT,
        currentUserId: profile?.id,
      })
    : [];

  const stickyUserId = profile?.id ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm">
          <div className="flex items-center gap-6 font-semibold">
            <Link href="/">BoardTenZorg</Link>
            {season ? (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Season {formatSeasonLabel(season.start_at, season.id)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Monthly Leaderboard</h1>
            <p className="text-sm text-muted-foreground">
              Live Elo standings for the active BoardTenZorg season.
            </p>
          </div>
          {profile ? (
            <Link
              href={`/players/${profile.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View your history
            </Link>
          ) : null}
        </div>

        {seasonId ? (
          <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left">
                  <th className="w-16">Rank</th>
                  <th>Player</th>
                  <th className="w-28 text-right">MMR</th>
                  <th className="w-32 text-right">Matches</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      No players have been rated this month yet.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((entry, index) => {
                    const isSticky =
                      stickyUserId &&
                      entry.user_id === stickyUserId &&
                      index >= LEADERBOARD_LIMIT;

                    return (
                      <tr
                        key={`${entry.user_id}-${entry.rank}`}
                        className={`border-t border-border/40 transition-colors hover:bg-muted/30 ${isSticky ? "bg-primary/10 font-semibold" : ""}`}
                      >
                        <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                          #{entry.rank}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/players/${entry.user_id}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {entry.username}
                            </Link>
                            {isSticky ? (
                              <span className="text-xs uppercase tracking-wide text-primary">
                                You
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {entry.rating_current}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {entry.matches_played}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {leaderboard.length > LEADERBOARD_LIMIT && stickyUserId ? (
              <div className="border-t border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Showing top {LEADERBOARD_LIMIT}. Your row is pinned even if
                ranked lower.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No active season yet. Admins can start one from the admin console.
          </div>
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} BoardTenZorg</p>
          <Link href="/admin" className="font-medium hover:underline">
            Admin console
          </Link>
        </div>
      </footer>
    </div>
  );
}
