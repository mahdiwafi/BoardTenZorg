import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getPlayerHistory,
  getPlayerSeasonStats,
  getSeasonById,
  getUserProfileById,
} from "@/lib/boardtenzorg";

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
  params: { id: string };
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const playerProfile = await getUserProfileById(params.id);
  if (!playerProfile) {
    notFound();
  }

  const [seasonId, viewerProfile] = await Promise.all([
    getActiveSeasonId(),
    getCurrentUserProfile(),
  ]);

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const [history, seasonStats] = seasonId
    ? await Promise.all([
        getPlayerHistory(seasonId, playerProfile.id),
        getPlayerSeasonStats(seasonId, playerProfile.id),
      ])
    : [[], { rating: 1000, matches_played: 0 }];

  const isSelf = viewerProfile?.id === playerProfile.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4 text-sm">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              ← Back to leaderboard
            </Link>
            {season ? (
              <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                Season {season.id}
              </span>
            ) : null}
          </div>
          <Link href="/admin" className="text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">
            {playerProfile.username ?? playerProfile.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? "Your rated matches for the active season."
              : `Rated matches for ${playerProfile.username ?? "this player"} in the active season.`}
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Current MMR</p>
            <p className="mt-2 text-2xl font-semibold">{seasonStats.rating}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Matches played</p>
            <p className="mt-2 text-2xl font-semibold">{seasonStats.matches_played}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Profile ID</p>
            <p className="mt-2 font-mono text-lg">{playerProfile.id}</p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Match history</h2>
          <p className="text-sm text-muted-foreground">
            Latest {history.length} rated matches with MMR changes.
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border border-border/80 bg-card">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left">
                  <th className="w-36">Date</th>
                  <th>Opponent</th>
                  <th className="w-28 text-right">Result</th>
                  <th className="w-24 text-right">Δ MMR</th>
                  <th className="w-28 text-right">Post</th>
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
                          <span className="text-emerald-500">Win</span>
                        ) : (
                          <span className="text-rose-500">Loss</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {event.delta > 0 ? `+${event.delta}` : event.delta}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {event.rating_after}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {event.tournament_name || "—"}
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
