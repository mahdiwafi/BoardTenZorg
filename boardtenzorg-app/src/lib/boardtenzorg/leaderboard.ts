import { createClient } from "@/lib/supabase/server";

import type {
  LeaderboardEntry,
  PlayerHistoryEntry,
  PlayerSeasonStats,
} from "./types";

export async function getLeaderboard(
  seasonId: string,
  opts?: { limit?: number; currentUserId?: string },
) {
  const supabase = await createClient();
  const limit = opts?.limit ?? 50;

  const { data, error } = await supabase
    .from("player_season_ratings")
    .select(
      "user_id, rating_current, matches_played, first_reached_current_rating_at, users(username)",
    )
    .eq("season_id", seasonId)
    .order("rating_current", { ascending: false })
    .order("matches_played", { ascending: false, nullsFirst: false })
    .order("first_reached_current_rating_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  type LeaderboardRow = {
    user_id: string;
    rating_current: number | null;
    matches_played: number | null;
    users: { username: string | null } | { username: string | null }[] | null;
  };

  const rows = (data ?? []) as LeaderboardRow[];

  const allEntries: LeaderboardEntry[] = rows.map((row, index) => {
    const userRecord = Array.isArray(row.users) ? row.users[0] ?? null : row.users;

    return {
      rank: index + 1,
      user_id: row.user_id,
      username: userRecord?.username ?? "Unknown Player",
      rating_current: row.rating_current ?? 0,
      matches_played: row.matches_played ?? 0,
    };
  });

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

export async function getPlayerHistory(
  seasonId: string,
  userId: string,
  limit = 100,
) {
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

  type MatchRow = {
    completed_at: string | null;
    winner_user_id: string | null;
    p1_user_id: string | null;
    p2_user_id: string | null;
    tournaments: { name: string | null } | { name: string | null }[] | null;
  };

  type RatingEventRow = {
    id: string;
    match_id: string;
    rating_before: number | null;
    rating_after: number | null;
    delta: number | null;
    created_at: string;
    matches: MatchRow | MatchRow[] | null;
  };

  const events = (data ?? []) as RatingEventRow[];
  const opponentIds = new Set<string>();

  for (const event of events) {
    const match = Array.isArray(event.matches) ? event.matches[0] ?? null : event.matches;
    if (!match) continue;
    const opponentId =
      match.p1_user_id === userId ? match.p2_user_id : match.p1_user_id;
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

    opponentMap = new Map(
      (opponentData ?? []).map((row) => [row.id, row.username ?? "Unknown"]),
    );
  }

  return events.map((event) => {
    const match = Array.isArray(event.matches) ? event.matches[0] ?? null : event.matches;
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

    const opponentId =
      match.p1_user_id === userId ? match.p2_user_id : match.p1_user_id;
    const opponentName = opponentId ? opponentMap.get(opponentId) ?? null : null;
    const tournaments = Array.isArray(match.tournaments)
      ? match.tournaments[0] ?? null
      : match.tournaments;

    return {
      id: event.id,
      match_id: event.match_id,
      tournament_name: tournaments?.name ?? "",
      opponent_username: opponentName,
      result: match.winner_user_id === userId ? "win" : "loss",
      rating_before: event.rating_before ?? 0,
      rating_after: event.rating_after ?? 0,
      delta: event.delta ?? 0,
      completed_at: match.completed_at ?? event.created_at,
    } satisfies PlayerHistoryEntry;
  });
}

export async function getPlayerSeasonStats(
  seasonId: string,
  userId: string,
): Promise<PlayerSeasonStats> {
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
