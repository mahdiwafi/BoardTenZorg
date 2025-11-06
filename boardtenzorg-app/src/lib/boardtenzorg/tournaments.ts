import { createClient } from "@/lib/supabase/server";

import type { Tournament, TournamentWithRegistration } from "./types";

type RawTournamentRow = {
  id: string;
  name: string;
  challonge_url: string;
  challonge_slug: string | null;
  state: "registered" | "rated";
  season_id: string;
  created_at: string;
  tournament_players?: Array<{ user_id: string | null } | null> | null;
};

function mapTournamentRow(
  row: RawTournamentRow,
  currentUserId?: string,
): Tournament | TournamentWithRegistration {
  const playerIds = Array.isArray(row.tournament_players)
    ? row.tournament_players
        .map((entry) => entry?.user_id)
        .filter((id: string | null | undefined): id is string => Boolean(id))
    : [];

  const base: Tournament = {
    id: row.id,
    name: row.name,
    challonge_url: row.challonge_url,
    challonge_slug: row.challonge_slug,
    state: row.state,
    season_id: row.season_id,
    created_at: row.created_at,
    player_count: playerIds.length,
  };

  if (!currentUserId) {
    return base;
  }

  return {
    ...base,
    isRegistered: playerIds.includes(currentUserId),
  };
}

export async function listSeasonTournaments(seasonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, challonge_url, challonge_slug, state, season_id, created_at, tournament_players ( user_id )",
    )
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapTournamentRow(row as RawTournamentRow),
  ) as Tournament[];
}

export async function listTournamentsForUser(
  seasonId: string,
  userId: string,
) {
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

  return (data ?? []).map((row) =>
    mapTournamentRow(row as RawTournamentRow, userId),
  ) as TournamentWithRegistration[];
}
