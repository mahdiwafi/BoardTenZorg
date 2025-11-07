import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyElo, type EloStage } from "../../../src/lib/elo.ts";

type Payload = {
  tournamentId?: string;
  rerun?: boolean;
};

type ChallongeParticipant = {
  participant: {
    id: number;
    name: string;
    display_name: string | null;
    active: boolean;
  };
};

type ChallongeMatch = {
  match: {
    id: number;
    player1_id: number | null;
    player2_id: number | null;
    winner_id: number | null;
    loser_id: number | null;
    scores_csv: string | null;
    completed_at: string | null;
    updated_at: string | null;
    started_at: string | null;
    round: number | null;
    state: string;
  };
};

type RatingState = {
  rating: number;
  matches: number;
  firstReached: string | null;
};

const CHALLONGE_API_BASE = "https://api.challonge.com/v1";

Deno.serve(async (request) => {
  try {
    const env = validateEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const payload = (await request.json().catch(() => ({}))) as Payload;
    if (!payload.tournamentId) {
      return respond(400, { error: "Missing tournamentId" });
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, season_id, challonge_slug, challonge_url, state")
      .eq("id", payload.tournamentId)
      .maybeSingle();

    if (tournamentError) {
      throw new Error(`Failed to load tournament: ${tournamentError.message}`);
    }
    if (!tournament) {
      return respond(404, { error: "Tournament not found." });
    }

    const slug = tournament.challonge_slug ?? extractSlug(tournament.challonge_url);
    if (!slug) {
      return respond(400, { error: "Tournament Challonge slug missing." });
    }

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id, k_factor")
      .eq("id", tournament.season_id)
      .maybeSingle();
    if (seasonError) {
      throw new Error(`Failed to load season: ${seasonError.message}`);
    }
    if (!season) {
      return respond(400, { error: "Season not found for tournament." });
    }
    const kFactor = season.k_factor ?? 28;

    const registeredPlayers = await loadTournamentPlayers(supabase, payload.tournamentId);
    const participants = await fetchChallonge<ChallongeParticipant[]>(
      `${CHALLONGE_API_BASE}/tournaments/${encodeURIComponent(slug)}/participants.json`,
      env.CHALLONGE_API_KEY,
    );
    const participantMap = buildParticipantMap(participants, registeredPlayers);

    const matchesResponse = await fetchChallonge<ChallongeMatch[]>(
      `${CHALLONGE_API_BASE}/tournaments/${encodeURIComponent(slug)}/matches.json?state=complete`,
      env.CHALLONGE_API_KEY,
    );
    const completedMatches = matchesResponse
      .filter((m) => m.match.state === "complete" && m.match.winner_id && m.match.player1_id && m.match.player2_id)
      .sort((a, b) => {
        const aDate = a.match.completed_at ?? a.match.updated_at ?? a.match.started_at ?? "";
        const bDate = b.match.completed_at ?? b.match.updated_at ?? b.match.started_at ?? "";
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });

    const isDoubleElimination = completedMatches.some(
      (m) => typeof m.match.round === "number" && m.match.round < 0,
    );

    // Update Challonge participant IDs on registrations.
    await syncParticipantMetadata(supabase, payload.tournamentId, participantMap);

    const playerIds = Array.from(
      new Set(
        completedMatches.flatMap((m) => {
          const p1 = participantMap.get(m.match.player1_id ?? -1);
          const p2 = participantMap.get(m.match.player2_id ?? -1);
          return [p1?.user_id, p2?.user_id].filter((v): v is string => Boolean(v));
        }),
      ),
    );

    if (playerIds.length === 0) {
      return respond(200, { ok: true, message: "No completed matches to rate." });
    }

    if (payload.rerun) {
      await rollbackTournamentRatings(supabase, payload.tournamentId, tournament.season_id);
    }

    const ratingState = await loadRatingState(supabase, playerIds, tournament.season_id);
    const entrantsCount = Math.max(ratingState.size, participantMap.size, registeredPlayers.length, 1);
    let currentTopRating = getCurrentTopRating(ratingState);

    const matchesPayload: Array<Record<string, unknown>> = [];
    const ratingEventsPayload: Array<Record<string, unknown>> = [];
    let skippedMatches = 0;

    for (const wrapper of completedMatches) {
      const match = wrapper.match;
      const p1 = participantMap.get(match.player1_id ?? -1);
      const p2 = participantMap.get(match.player2_id ?? -1);

      if (!p1 || !p2) {
        console.warn(`[tournament-rate] Skipping match ${match.id} due to unmapped participants.`);
        skippedMatches += 1;
        continue;
      }

      const winnerParticipantId = match.winner_id;
      if (!winnerParticipantId) {
        console.warn(`[tournament-rate] Skipping match ${match.id} due to missing winner id.`);
        skippedMatches += 1;
        continue;
      }
      const winnerUserId = participantMap.get(winnerParticipantId)?.user_id;
      if (!winnerUserId) {
        console.warn(`[tournament-rate] Skipping match ${match.id} due to unknown winner.`);
        skippedMatches += 1;
        continue;
      }

      const p1State = ratingState.get(p1.user_id);
      const p2State = ratingState.get(p2.user_id);
      if (!p1State || !p2State) {
        console.warn(`[tournament-rate] Missing rating state for players in match ${match.id}. Skipping.`);
        skippedMatches += 1;
        continue;
      }
      const completedAt = match.completed_at ?? match.updated_at ?? new Date().toISOString();

      const winnerIsP1 = winnerUserId === p1.user_id;
      const prevRatingP1 = p1State.rating;
      const prevRatingP2 = p2State.rating;

      const stage = deriveStage(match.round, isDoubleElimination);
      const scoreGap = computeScoreGap(match.scores_csv);

      const { deltaA, deltaB, newRatingA, newRatingB } = applyElo({
        ratingA: p1State.rating,
        ratingB: p2State.rating,
        scoreA: winnerIsP1 ? 1 : 0,
        context: {
          entrantsCount,
          stage,
          scoreGap,
          topRating: currentTopRating,
          baseK: kFactor,
        },
      });

      const winnerRatingAfter = winnerIsP1 ? newRatingA : newRatingB;
      const loserRatingAfter = winnerIsP1 ? newRatingB : newRatingA;

      const matchId = crypto.randomUUID();

      matchesPayload.push({
        id: matchId,
        tournament_id: payload.tournamentId,
        challonge_match_id: match.id,
        p1_user_id: p1.user_id,
        p2_user_id: p2.user_id,
        winner_user_id: winnerUserId,
        scores_csv: match.scores_csv ?? "",
        winner_points: winnerRatingAfter,
        loser_points: loserRatingAfter,
        score_diff: scoreGap,
        completed_at: completedAt,
      });

      ratingEventsPayload.push(
        createRatingEvent({
          matchId,
          seasonId: tournament.season_id,
          userId: p1.user_id,
          ratingBefore: p1State.rating,
          ratingAfter: newRatingA,
          delta: deltaA,
          kFactor,
          createdAt: completedAt,
        }),
        createRatingEvent({
          matchId,
          seasonId: tournament.season_id,
          userId: p2.user_id,
          ratingBefore: p2State.rating,
          ratingAfter: newRatingB,
          delta: deltaB,
          kFactor,
          createdAt: completedAt,
        }),
      );

      p1State.rating = newRatingA;
      p2State.rating = newRatingB;
      p1State.matches += 1;
      p2State.matches += 1;
      if (newRatingA !== prevRatingP1) {
        p1State.firstReached = completedAt;
      }
      if (newRatingB !== prevRatingP2) {
        p2State.firstReached = completedAt;
      }
      currentTopRating = getCurrentTopRating(ratingState);
    }

    if (matchesPayload.length === 0) {
      return respond(200, { ok: true, message: "No valid matches processed.", skipped_matches: skippedMatches });
    }

    const { error: matchesInsertError } = await supabase.from("matches").insert(matchesPayload);
    if (matchesInsertError) {
      throw new Error(`Failed to insert matches: ${matchesInsertError.message}`);
    }

    const { error: eventsInsertError } = await supabase.from("rating_events").insert(ratingEventsPayload);
    if (eventsInsertError) {
      throw new Error(`Failed to insert rating events: ${eventsInsertError.message}`);
    }

    await persistRatingState(supabase, ratingState, tournament.season_id);

    const { error: stateUpdateError } = await supabase
      .from("tournaments")
      .update({ state: "rated" })
      .eq("id", payload.tournamentId);
    if (stateUpdateError) {
      throw new Error(`Failed to update tournament state: ${stateUpdateError.message}`);
    }

    return respond(200, {
      ok: true,
      processed_matches: matchesPayload.length,
      processed_players: ratingState.size,
      skipped_matches: skippedMatches,
    });
  } catch (error) {
    console.error("[tournament-rate] error", error);
    return respond(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

function validateEnv() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CHALLONGE_API_KEY = Deno.env.get("CHALLONGE_API_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables in Edge Function.");
  }

  if (!CHALLONGE_API_KEY) {
    throw new Error("Missing Challonge API key (CHALLONGE_API_KEY).");
  }

  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHALLONGE_API_KEY };
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function extractSlug(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
}

async function fetchChallonge<T>(url: string, apiKey: string): Promise<T> {
  const urlObj = new URL(url);
  urlObj.searchParams.set("api_key", apiKey);

  const response = await fetch(urlObj.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Challonge API error (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

function buildParticipantMap(
  participants: ChallongeParticipant[],
  registrations: Map<string, { user_id: string }>,
) {
  const map = new Map<number, { user_id: string; display_name: string }>();

  for (const wrapper of participants) {
    const participant = wrapper.participant;
    const code = extractPlayerCode(participant.display_name ?? participant.name);
    if (!code) continue;
    const registration = registrations.get(code);
    if (!registration) {
      console.warn(`[tournament-rate] Participant ${participant.id} code ${code} not registered in Supabase.`);
      continue;
    }

    const displayName =
      participant.display_name ??
      participant.name ??
      `[${registration.user_id}]`;
    map.set(participant.id, {
      user_id: registration.user_id,
      display_name: displayName,
    });
  }

  return map;
}

function extractPlayerCode(text: string | null | undefined) {
  if (!text) return null;
  const match = text.trim().match(/^\[([A-Z0-9]{5})\]/i);
  return match ? match[1].toUpperCase() : null;
}

async function loadTournamentPlayers(supabase: ReturnType<typeof createClient>, tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournamentId);

  if (error) {
    throw new Error(`Failed to load tournament registrations: ${error.message}`);
  }

  const map = new Map<string, { user_id: string }>();
  for (const row of data ?? []) {
    if (!row.user_id) continue;
    map.set(row.user_id.toUpperCase(), { user_id: row.user_id });
  }
  return map;
}

async function syncParticipantMetadata(
  supabase: ReturnType<typeof createClient>,
  tournamentId: string,
  participantMap: Map<number, { user_id: string; display_name: string }>,
) {
  if (participantMap.size === 0) return;
  const payload = Array.from(participantMap.entries()).map(([participantId, meta]) => ({
    tournament_id: tournamentId,
    user_id: meta.user_id,
    challonge_participant_id: participantId,
    challonge_display_name: meta.display_name,
  }));

  const { error } = await supabase.from("tournament_players").upsert(payload, {
    onConflict: "tournament_id,user_id",
  });
  if (error) {
    throw new Error(`Failed to update tournament participants: ${error.message}`);
  }
}

async function loadRatingState(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  seasonId: string,
) {
  const state = new Map<string, RatingState>();

  if (userIds.length === 0) return state;

  const { data, error } = await supabase
    .from("player_season_ratings")
    .select("user_id, rating_current, matches_played, first_reached_current_rating_at")
    .eq("season_id", seasonId)
    .in("user_id", userIds);

  if (error) {
    throw new Error(`Failed to load player ratings: ${error.message}`);
  }

  for (const row of data ?? []) {
    state.set(row.user_id, {
      rating: row.rating_current ?? 1000,
      matches: row.matches_played ?? 0,
      firstReached: row.first_reached_current_rating_at ?? null,
    });
  }

  const missing = userIds.filter((id) => !state.has(id));
  if (missing.length > 0) {
    const toInsert = missing.map((userId) => ({
      user_id: userId,
      season_id: seasonId,
      rating_current: 1000,
      matches_played: 0,
    }));
    const { error: insertError } = await supabase.from("player_season_ratings").upsert(toInsert);
    if (insertError) {
      throw new Error(`Failed to seed player ratings: ${insertError.message}`);
    }
    missing.forEach((id) =>
      state.set(id, {
        rating: 1000,
        matches: 0,
        firstReached: null,
      }),
    );
  }

  return state;
}

function createRatingEvent({
  matchId,
  seasonId,
  userId,
  ratingBefore,
  ratingAfter,
  delta,
  kFactor,
  createdAt,
}: {
  matchId: string;
  seasonId: string;
  userId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  kFactor: number;
  createdAt: string;
}) {
  return {
    season_id: seasonId,
    match_id: matchId,
    user_id: userId,
    rating_before: ratingBefore,
    rating_after: ratingAfter,
    delta,
    k_factor: kFactor,
    created_at: createdAt,
  };
}

function getCurrentTopRating(ratingState: Map<string, RatingState>): number {
  let top = 1000;
  for (const state of ratingState.values()) {
    top = Math.max(top, state.rating);
  }
  return top;
}

function computeScoreGap(scoresCsv: string | null): number {
  if (!scoresCsv) return 1;
  const segments = scoresCsv
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return 1;

  let playerOneTotal = 0;
  let playerTwoTotal = 0;
  for (const segment of segments) {
    const [aRaw, bRaw] = segment.split("-");
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      playerOneTotal += a;
      playerTwoTotal += b;
    }
  }

  const diff = Math.abs(playerOneTotal - playerTwoTotal);
  return Math.max(diff, 1);
}

function deriveStage(round: number | null | undefined, isDoubleElimination: boolean): EloStage {
  if (!isDoubleElimination) {
    return "RR";
  }
  if (round === 0) {
    return "GF";
  }
  if (typeof round === "number" && round < 0) {
    return "DE_LB";
  }
  if (typeof round === "number" && round > 0) {
    return "DE_UB";
  }
  return "RR";
}

async function persistRatingState(
  supabase: ReturnType<typeof createClient>,
  ratingState: Map<string, RatingState>,
  seasonId: string,
) {
  if (ratingState.size === 0) return;
  const updates = Array.from(ratingState.entries()).map(([userId, state]) => ({
    user_id: userId,
    season_id: seasonId,
    rating_current: state.rating,
    matches_played: state.matches,
    first_reached_current_rating_at: state.firstReached,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("player_season_ratings").upsert(updates);
  if (error) {
    throw new Error(`Failed to persist player ratings: ${error.message}`);
  }
}

async function rollbackTournamentRatings(
  supabase: ReturnType<typeof createClient>,
  tournamentId: string,
  seasonId: string,
) {
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (matchesError) {
    throw new Error(`Failed to load existing matches: ${matchesError.message}`);
  }

  if (!matches || matches.length === 0) {
    return;
  }

  const matchIds = matches.map((m) => m.id);

  const { data: events, error: eventsError } = await supabase
    .from("rating_events")
    .select("user_id, delta, rating_before, created_at")
    .in("match_id", matchIds)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(`Failed to load existing rating events: ${eventsError.message}`);
  }

  const adjustments = new Map<
    string,
    {
      matches: number;
      ratingBefore: number;
    }
  >();

  for (const event of events ?? []) {
    if (!adjustments.has(event.user_id)) {
      adjustments.set(event.user_id, {
        matches: 0,
        ratingBefore: event.rating_before,
      });
    }
    const agg = adjustments.get(event.user_id)!;
    agg.matches += 1;
    // events sorted ascending; keep earliest rating_before
    agg.ratingBefore = event.rating_before;
  }

  if (adjustments.size > 0) {
    const users = Array.from(adjustments.keys());
    const { data: ratingRows, error: ratingsError } = await supabase
      .from("player_season_ratings")
      .select("user_id, rating_current, matches_played")
      .eq("season_id", seasonId)
      .in("user_id", users);

    if (ratingsError) {
      throw new Error(`Failed to load ratings for rollback: ${ratingsError.message}`);
    }

    for (const row of ratingRows ?? []) {
      const adj = adjustments.get(row.user_id);
      if (!adj) continue;
      const newMatches = Math.max((row.matches_played ?? 0) - adj.matches, 0);
      const { error: updateError } = await supabase
        .from("player_season_ratings")
        .update({
          rating_current: adj.ratingBefore,
          matches_played: newMatches,
          updated_at: new Date().toISOString(),
        })
        .eq("season_id", seasonId)
        .eq("user_id", row.user_id);

      if (updateError) {
        throw new Error(`Failed to rollback rating for ${row.user_id}: ${updateError.message}`);
      }
    }
  }

  const { error: deleteEventsError } = await supabase.from("rating_events").delete().in("match_id", matchIds);
  if (deleteEventsError) {
    throw new Error(`Failed to delete old rating events: ${deleteEventsError.message}`);
  }

  const { error: deleteMatchesError } = await supabase.from("matches").delete().eq("tournament_id", tournamentId);
  if (deleteMatchesError) {
    throw new Error(`Failed to delete old matches: ${deleteMatchesError.message}`);
  }
}
