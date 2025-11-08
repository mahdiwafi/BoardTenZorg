import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getCurrentUserRoles,
  getLeaderboard,
  getSeasonById,
  type LeaderboardEntry,
} from "@/lib/boardtenzorg";
import { formatSeasonLabel } from "@/lib/utils/season";

const LEADERBOARD_LIMIT = 50;

export default async function LeaderboardPage() {
  const [profile, seasonId, roles] = await Promise.all([
    getCurrentUserProfile(),
    getActiveSeasonId(),
    getCurrentUserRoles(),
  ]);

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const seasonLabel = season
    ? formatSeasonLabel(season.start_at, season.id)
    : null;
  const leaderboard = seasonId
    ? await getLeaderboard(seasonId, {
        limit: LEADERBOARD_LIMIT,
        currentUserId: profile?.id,
      })
    : [];

  const stickyUserId = profile?.id ?? null;
  const isAuthenticated = Boolean(profile);
  const isAdmin = roles.includes("admin");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader
        seasonLabel={seasonLabel}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <LeaderboardHeading
          profileId={profile?.id ?? null}
          isAuthenticated={isAuthenticated}
        />

        {seasonId ? (
          <LeaderboardTable
            entries={leaderboard}
            stickyUserId={stickyUserId}
            isAuthenticated={isAuthenticated}
          />
        ) : (
          <NoSeasonNotice />
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <p>Copyright {new Date().getFullYear()} BoardTenZorg</p>
          <Link href="/admin" className="font-medium hover:underline">
            Admin console
          </Link>
        </div>
      </footer>
    </div>
  );
}

type LeaderboardHeadingProps = {
  profileId: string | null;
  isAuthenticated: boolean;
};

function LeaderboardHeading({
  profileId,
  isAuthenticated,
}: LeaderboardHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Monthly Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Live Elo standings for the active BoardTenZorg season.
        </p>
      </div>
      {profileId ? (
        <Link
          href={`/players/${profileId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View your public profile
        </Link>
      ) : !isAuthenticated ? (
        <Link
          href="/auth/login?redirect=/profile/history"
          className="text-sm font-medium text-primary hover:underline"
        >
          Sign in to view your history
        </Link>
      ) : null}
    </div>
  );
}

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  stickyUserId: string | null;
  isAuthenticated: boolean;
};

function LeaderboardTable({
  entries,
  stickyUserId,
  isAuthenticated,
}: LeaderboardTableProps) {
  const hasEntries = entries.length > 0;
  const showPinnedNotice = Boolean(stickyUserId) && entries.length > LEADERBOARD_LIMIT;

  return (
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
          {hasEntries ? (
            entries.map((entry, index) => (
              <LeaderboardRow
                key={`${entry.user_id}-${entry.rank}`}
                entry={entry}
                isSticky={
                  Boolean(stickyUserId) &&
                  entry.user_id === stickyUserId &&
                  index >= LEADERBOARD_LIMIT
                }
                isAuthenticated={isAuthenticated}
              />
            ))
          ) : (
            <EmptyLeaderboardRow />
          )}
        </tbody>
      </table>
      {showPinnedNotice ? (
        <div className="border-t border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Showing top {LEADERBOARD_LIMIT}. Your row is pinned even if ranked lower.
        </div>
      ) : null}
    </div>
  );
}

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
  isSticky: boolean;
  isAuthenticated: boolean;
};

function LeaderboardRow({
  entry,
  isSticky,
  isAuthenticated,
}: LeaderboardRowProps) {
  const targetHref = isAuthenticated
    ? `/players/${entry.user_id}`
    : `/auth/login?redirect=${encodeURIComponent(`/players/${entry.user_id}`)}`;

  return (
    <tr
      className={`border-t border-border/40 transition-colors hover:bg-muted/30 ${
        isSticky ? "bg-primary/10 font-semibold" : ""
      }`}
    >
      <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
        #{entry.rank}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col">
          <Link
            href={targetHref}
            className="text-sm font-medium hover:underline"
          >
            {entry.username}
          </Link>
          {isSticky ? (
            <span className="text-xs uppercase tracking-wide text-primary">You</span>
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
}

function EmptyLeaderboardRow() {
  return (
    <tr>
      <td
        colSpan={4}
        className="px-3 py-8 text-center text-sm text-muted-foreground"
      >
        No players have been rated this month yet.
      </td>
    </tr>
  );
}

function NoSeasonNotice() {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      No active season yet. Admins can start one from the admin console.
    </div>
  );
}
