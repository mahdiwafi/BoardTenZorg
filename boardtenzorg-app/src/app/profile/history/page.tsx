import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getPlayerHistory,
  getPlayerSeasonStats,
  type PlayerHistoryEntry,
} from "@/lib/boardtenzorg";
import { createClient } from "@/lib/supabase/server";

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

export default async function ProfileHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [profile, seasonId] = await Promise.all([
    getCurrentUserProfile(),
    getActiveSeasonId(),
  ]);

  if (!profile) {
    redirect("/profile");
  }

  let history: PlayerHistoryEntry[] = [];
  let stats = { rating: 1000, matches_played: 0 };

  if (seasonId) {
    [history, stats] = await Promise.all([
      getPlayerHistory(seasonId, profile.id),
      getPlayerSeasonStats(seasonId, profile.id),
    ]);
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Match history</h1>
          <p className="text-sm text-muted-foreground">
            Rated matches you have played in the active season with per-match Elo updates.
          </p>
        </div>
        <Link href="/profile" className="text-sm font-medium text-primary hover:underline">
          &larr; Back to profile
        </Link>
      </div>

      {!seasonId ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No active season yet. Check back once a season starts to track your rated matches.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Current MMR</p>
              <p className="mt-2 text-2xl font-semibold">{stats.rating}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Matches played</p>
              <p className="mt-2 text-2xl font-semibold">{stats.matches_played}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Player ID</p>
              <p className="mt-2 font-mono text-lg">{profile.id}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left">
                  <th className="w-36">Date</th>
                  <th className="w-52">Tournament</th>
                  <th>Opponent</th>
                  <th className="w-24 text-right">Result</th>
                  <th className="w-28 text-right">Elo change</th>
                  <th className="w-28 text-right">Post match</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No rated matches recorded yet this season.
                    </td>
                  </tr>
                ) : (
                  history.map((event) => (
                    <tr key={event.id} className="border-t border-border/40">
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDate(event.completed_at)}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {event.tournament_name || "Unassigned"}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
