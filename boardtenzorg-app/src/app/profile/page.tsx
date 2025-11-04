import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getCurrentUserRoles,
  getPlayerSeasonStats,
  listTournamentsForUser,
} from "@/lib/boardtenzorg";
import { createClient } from "@/lib/supabase/server";

import { UsernameForm } from "./_components/username-form";
import { TournamentList } from "./_components/tournament-list";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [profile, roles, seasonId] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserRoles(),
    getActiveSeasonId(),
  ]);

  let tournaments = [];
  let stats = { rating: 1000, matches_played: 0 };

  if (profile && seasonId) {
    const [seasonTournaments, seasonStats] = await Promise.all([
      listTournamentsForUser(seasonId, profile.id),
      getPlayerSeasonStats(seasonId, profile.id),
    ]);

    tournaments = seasonTournaments;
    stats = seasonStats;
  }

  const isAdmin = roles.includes("admin");

  return (
    <div className="space-y-12">
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-muted-foreground">
            Set your public username and join upcoming tournaments. Your 5-character ID is used when exporting
            to Challonge.
          </p>

          <div className="rounded-lg border border-border bg-card p-4">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Player ID</dt>
                <dd className="font-mono text-base">{profile?.id ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Season rating</dt>
                <dd className="font-medium">{stats.rating}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Matches played</dt>
                <dd className="font-medium">{stats.matches_played}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="font-medium capitalize">
                  {roles.length > 0 ? roles.join(", ") : "player"}
                </dd>
              </div>
            </dl>
            {isAdmin ? (
              <div className="mt-4">
                <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
                  Open admin console →
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <UsernameForm initialUsername={profile?.username ?? null} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tournaments this month</h2>
          <p className="text-sm text-muted-foreground">
            Register ahead of time. Admins will export the list directly to Challonge when seeding the bracket.
          </p>
        </div>

        {profile && seasonId ? (
          <TournamentList tournaments={tournaments} />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            Set a username first to unlock tournament registration.
          </div>
        )}
      </section>
    </div>
  );
}
