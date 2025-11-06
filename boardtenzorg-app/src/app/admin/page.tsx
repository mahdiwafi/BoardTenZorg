import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveSeasonId,
  getCurrentUserRoles,
  getSeasonById,
  listSeasonTournaments,
} from "@/lib/boardtenzorg";
import { createClient } from "@/lib/supabase/server";

import { CreateTournamentForm } from "./_components/create-tournament-form";
import { FinalizeSeasonButton } from "./_components/finalize-season-button";
import { ParticipantsExport } from "./_components/participants-export";
import { RateTournamentButton } from "./_components/rate-tournament-button";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const roles = await getCurrentUserRoles();
  if (!roles.includes("admin")) {
    redirect("/");
  }

  const seasonId = await getActiveSeasonId();
  const season = seasonId ? await getSeasonById(seasonId) : null;
  const tournaments = seasonId ? await listSeasonTournaments(seasonId) : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm">
          <div className="flex items-center gap-6 font-semibold">
            <Link href="/">BoardTenZorg</Link>
            <span className="text-xs uppercase text-muted-foreground">Admin</span>
          </div>
          <Link href="/" className="text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
            Leaderboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10">
        <section className="grid gap-6 rounded-lg border border-border bg-card p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Season control</h1>
            {season ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Active season</dt>
                  <dd className="font-medium">{season.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">{season.status}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No active season. Create one manually in Supabase or wait for the cron job.
              </p>
            )}
          </div>
          <FinalizeSeasonButton />
        </section>

        <section>
          <CreateTournamentForm />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Registered tournaments</h2>
            <p className="text-sm text-muted-foreground">
              Export participants to Challonge, then run the rating job once results are final.
            </p>
          </div>

          {tournaments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No tournaments yet for the current season.
            </div>
          ) : (
            <div className="space-y-4">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{tournament.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Challonge:{" "}
                        <a
                          href={tournament.challonge_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {tournament.challonge_slug ?? tournament.challonge_url}
                        </a>
                      </p>
                      <p className="text-xs uppercase text-muted-foreground">
                        Status: {tournament.state} | Registered players: {tournament.player_count}
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 md:w-64">
                      <ParticipantsExport tournamentId={tournament.id} />
                      <RateTournamentButton
                        tournamentId={tournament.id}
                        state={tournament.state}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
