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

export type PlayerSeasonStats = {
  rating: number;
  matches_played: number;
};
