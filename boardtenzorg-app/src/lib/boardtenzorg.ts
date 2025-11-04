import { createClient } from "@/lib/supabase/server";
import { generatePublicId } from "@/lib/id";

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  rating_current: number;
  matches_played: number;
};

export type PlayerHistoryEntry = {
  id: string;
  match_id: string;
  tournament_name: string;
  opponent_username: string | null;
  result: "win" | "loss";
  rating_before: number;
  rating_after: number;
  delta: number;
  completed_at: string;
};

export type Tournament = {
  id: string;
  name: string;
  challonge_url: string;
  challonge_slug: string | null;
  state: "registered" | "rated";
  season_id: string;
  created_at: string;
  player_count: number;
};

export type TournamentWithRegistration = Tournament & {
  isRegistered: boolean;
};

export type Season = {
  id: string;
  status: "active" | "finalized";
  start_at: string;
  end_at: string | null;
};

export type ProfileRecord = {
  id: string;
  username: string | null;
};

export type PublicProfile = ProfileRecord & {
  created_at: string | null;
};

export type UserRoles = "admin" | "player";

export async function getActiveSeasonId() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function getSeasonById(seasonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, status, start_at, end_at")
    .eq("id", seasonId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? ({ ...data } satisfies Season) : null;
}

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();

  if (!session.user) {
    return null;
  }

  const profile = await fetchProfileByAuthId(supabase, session.user.id);
  if (profile) {
    return profile;
  }

  let lastError: { message?: string } | null = null;
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const candidate = generatePublicId();
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        id: candidate,
        auth_user_id: session.user.id,
      })
      .select("id, username")
      .maybeSingle();

    if (!insertError && inserted) {
      return { id: inserted.id, username: inserted.username ?? null } satisfies ProfileRecord;
    }

    if (insertError?.code === "23505") {
      const existing = await fetchProfileByAuthId(supabase, session.user.id);
      if (existing) {
        return existing;
      }
      lastError = insertError;
      continue;
    }

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  throw new Error(lastError?.message ?? "Could not assign player id.");
}

async function fetchProfileByAuthId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? ({ id: data.id, username: data.username ?? null } satisfies ProfileRecord) : null;
}

export async function getCurrentUserRoles() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();

  if (!session.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_user_id", session.user.id);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.role) as UserRoles[];
}

export async function getUserProfileById(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? ({
        id: data.id,
        username: data.username ?? null,
        created_at: data.created_at ?? null,
      } satisfies PublicProfile)
    : null;
}

export async function getLeaderboard(seasonId: string, opts?: { limit?: number; currentUserId?: string }) {
  const supabase = await createClient();
  const limit = opts?.limit ?? 50;

  const { data, error } = await supabase
    .from("player_season_ratings")
    .select("user_id, rating_current, matches_played, first_reached_current_rating_at, users(username)")
    .eq("season_id", seasonId)
    .order("rating_current", { ascending: false })
    .order("matches_played", { ascending: false, nullsFirst: false })
    .order("first_reached_current_rating_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const allEntries: LeaderboardEntry[] = (data ?? []).map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    username: row.users?.username ?? "Unknown Player",
    rating_current: row.rating_current ?? 0,
    matches_played: row.matches_played ?? 0,
  }));

  const base = allEntries.slice(0, limit);
  const stickyId = opts?.currentUserId;

  if (!stickyId) {
    return base;
  }

  const alreadyVisible = base.some((entry) => entry.user_id === stickyId);
  if (alreadyVisible) {
    return base;
  }

  const selfEntry = allEntries.find((entry) => entry.user_id === stickyId);
  if (!selfEntry) {
    return base;
  }

  return [...base, selfEntry];
}

export async function getPlayerHistory(seasonId: string, userId: string, limit = 100) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rating_events")
    .select(
      `
        id,
        match_id,
        rating_before,
        rating_after,
        delta,
        created_at,
        matches!inner (
          completed_at,
          winner_user_id,
          p1_user_id,
          p2_user_id,
          tournaments!inner (
            name
          )
        )
      `,
    )
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const events = data ?? [];
  const opponentIds = new Set<string>();

  for (const event of events) {
    const match = event.matches;
    if (!match) continue;
    const opponentId = match.p1_user_id === userId ? match.p2_user_id : match.p1_user_id;
    if (opponentId) {
      opponentIds.add(opponentId);
    }
  }

  let opponentMap = new Map<string, string>();
  if (opponentIds.size > 0) {
    const { data: opponentData, error: opponentError } = await supabase
      .from("users")
      .select("id, username")
      .in("id", Array.from(opponentIds));

    if (opponentError) {
      throw new Error(opponentError.message);
    }

    opponentMap = new Map((opponentData ?? []).map((row) => [row.id, row.username ?? "Unknown"]));
  }

  return events.map((event) => {
    const match = event.matches;
    if (!match) {
      return {
        id: event.id,
        match_id: event.match_id,
        tournament_name: "",
        opponent_username: null,
        result: "win" as const,
        rating_before: event.rating_before ?? 0,
        rating_after: event.rating_after ?? 0,
        delta: event.delta ?? 0,
        completed_at: event.created_at,
      };
    }

    const opponentId = match.p1_user_id === userId ? match.p2_user_id : match.p1_user_id;
    const opponentName = opponentId ? opponentMap.get(opponentId) ?? null : null;

    return {
      id: event.id,
      match_id: event.match_id,
      tournament_name: match.tournaments?.name ?? "",
      opponent_username: opponentName,
      result: match.winner_user_id === userId ? "win" : "loss",
      rating_before: event.rating_before ?? 0,
      rating_after: event.rating_after ?? 0,
      delta: event.delta ?? 0,
      completed_at: match.completed_at ?? event.created_at,
    } satisfies PlayerHistoryEntry;
  });
}

export async function listSeasonTournaments(seasonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, challonge_url, challonge_slug, state, season_id, created_at, tournament_players ( user_id )")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    challonge_url: row.challonge_url,
    challonge_slug: row.challonge_slug,
    state: row.state,
    season_id: row.season_id,
    created_at: row.created_at,
    player_count: Array.isArray(row.tournament_players) ? row.tournament_players.length : 0,
  })) as Tournament[];
}

export async function getPlayerSeasonStats(seasonId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_season_ratings")
    .select("rating_current, matches_played")
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    rating: data?.rating_current ?? 1000,
    matches_played: data?.matches_played ?? 0,
  };
}

export async function listTournamentsForUser(seasonId: string, userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `
        id,
        name,
        challonge_url,
        challonge_slug,
        state,
        season_id,
        created_at,
        tournament_players!left (user_id)
      `,
    )
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    challonge_url: row.challonge_url,
    challonge_slug: row.challonge_slug,
    state: row.state,
    season_id: row.season_id,
    created_at: row.created_at,
    player_count: Array.isArray(row.tournament_players) ? row.tournament_players.length : 0,
    isRegistered: Array.isArray(row.tournament_players)
      ? row.tournament_players.some((player) => player?.user_id === userId)
      : false,
  })) as TournamentWithRegistration[];
}
