import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getCurrentUserRoles,
  getPlayerHistory,
  getPlayerSeasonStats,
  getSeasonById,
  getUserProfileById,
} from "@/lib/boardtenzorg";
import { formatSeasonLabel } from "@/lib/utils/season";

function formatDate(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  } catch {
    return value;
  }
}

type PlayerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params;
  const playerProfile = await getUserProfileById(id);
  if (!playerProfile) {
    notFound();
  }

  const [seasonId, viewerProfile, roles] = await Promise.all([
    getActiveSeasonId(),
    getCurrentUserProfile(),
    getCurrentUserRoles(),
  ]);

  if (!viewerProfile) {
    redirect(`/auth/login?redirect=/players/${id}`);
  }

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const [history, seasonStats] = seasonId
    ? await Promise.all([
        getPlayerHistory(seasonId, playerProfile.id),
        getPlayerSeasonStats(seasonId, playerProfile.id),
      ])
    : [[], { rating: 1000, matches_played: 0 }];

  const isSelf = viewerProfile.id === playerProfile.id;
  const seasonLabel = season
    ? formatSeasonLabel(season.start_at, season.id)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader
        seasonLabel={seasonLabel}
        isAuthenticated
        isAdmin={roles.includes("admin")}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 space-y-10">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-primary hover:underline">
            &larr; Back to leaderboard
          </Link>
          {seasonLabel ? (
            <span className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Season {seasonLabel}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {playerProfile.username ?? playerProfile.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? "Your rated matches for the active season."
              : `Rated matches for ${playerProfile.username ?? "this player"} in the active season.`}
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Current MMR</p>
            <p className="mt-2 text-2xl font-semibold">{seasonStats.rating}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Matches played</p>
            <p className="mt-2 text-2xl font-semibold">{seasonStats.matches_played}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Player ID</p>
            <p className="mt-2 font-mono text-lg">{playerProfile.id}</p>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Match history</h2>
            <p className="text-sm text-muted-foreground">
              Latest {history.length} rated matches with MMR changes.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left">
                  <th className="w-36">Date</th>
                  <th>Opponent</th>
                  <th className="w-28 text-right">Result</th>
                  <th className="w-24 text-right">Delta</th>
                  <th className="w-28 text-right">Post MMR</th>
                  <th className="w-48">Tournament</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm text-muted-foreground"
                    >
                      No rated matches yet this season.
                    </td>
                  </tr>
                ) : (
                  history.map((event) => (
                    <tr key={event.id} className="border-t border-border/40">
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDate(event.completed_at)}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium">
                        {event.opponent_username ?? "Unknown"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {event.result === "win" ? (
                          <span className="text-primary">Win</span>
                        ) : (
                          <span className="text-destructive">Loss</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {event.delta > 0 ? `+${event.delta}` : event.delta}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {event.rating_after}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {event.tournament_name || "Unassigned"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
