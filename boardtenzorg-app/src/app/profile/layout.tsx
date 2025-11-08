import { SiteHeader } from "@/components/site-header";
import {
  getActiveSeasonId,
  getCurrentUserProfile,
  getCurrentUserRoles,
  getSeasonById,
} from "@/lib/boardtenzorg";
import { formatSeasonLabel } from "@/lib/utils/season";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, roles, seasonId] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserRoles(),
    getActiveSeasonId(),
  ]);

  const season = seasonId ? await getSeasonById(seasonId) : null;
  const seasonLabel = season
    ? formatSeasonLabel(season.start_at, season.id)
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader
        seasonLabel={seasonLabel}
        isAuthenticated={Boolean(profile)}
        isAdmin={roles.includes("admin")}
      />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
