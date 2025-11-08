import { SiteHeader } from "@/components/site-header";
import { TournamentList } from "@/components/tournaments/tournament-list";
import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getCurrentUserRoles,
  getSeasonById,
  listSeasonTournaments,
  listTournamentsForUser,
  type TournamentWithRegistration,
} from "@/lib/boardtenzorg";
import { formatSeasonLabel } from "@/lib/utils/season";

export default async function TournamentsPage() {
  const [profile, roles, seasonId] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserRoles(),
    getActiveSeasonId(),
  ]);

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const seasonLabel = season
    ? formatSeasonLabel(season.start_at, season.id)
    : null;

  let tournaments: TournamentWithRegistration[] = [];
  if (seasonId) {
    if (profile) {
      tournaments = await listTournamentsForUser(seasonId, profile.id);
    } else {
      const publicTournaments = await listSeasonTournaments(seasonId);
      tournaments = publicTournaments.map((tournament) => ({
        ...tournament,
        isRegistered: false,
      }));
    }
  }

  const isAuthenticated = Boolean(profile);
  const readyToRegister = Boolean(profile?.username);
  const loginHref = isAuthenticated
    ? undefined
    : "/auth/login?redirect=/tournaments";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader
        seasonLabel={seasonLabel}
        isAuthenticated={isAuthenticated}
        isAdmin={roles.includes("admin")}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Tournament hub
          </p>
          <h1 className="text-2xl font-semibold">Monthly events</h1>
          <p className="text-sm text-muted-foreground">
            Everyone can see the tournament list. Sign in to register or track your registration status for the month.
          </p>
        </div>

        {!seasonId ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            No active season yet. Check back once admins open registrations.
          </div>
        ) : (
          <>
            {!isAuthenticated ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Sign in to register and sync your Challonge username automatically.
              </div>
            ) : !readyToRegister ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Set a username on your profile before registering so admins can export brackets correctly.
              </div>
            ) : null}
            <TournamentList
              tournaments={tournaments}
              canRegister={readyToRegister}
              loginHref={loginHref}
            />
          </>
        )}
      </main>
    </div>
  );
}

