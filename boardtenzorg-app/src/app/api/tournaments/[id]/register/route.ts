import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = new URL(request.url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const tournamentId = parts.length >= 4 ? parts[2] : "";

  if (!tournamentId) {
    return NextResponse.json({ error: "Invalid tournament id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.id) {
    return NextResponse.json({ error: "Complete your profile before registering." }, { status: 400 });
  }

  if (!profile.username) {
    return NextResponse.json({ error: "Set a username before joining tournaments." }, { status: 400 });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, state")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  }

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  if (tournament.state !== "registered") {
    return NextResponse.json({ error: "Tournament is not open for registration." }, { status: 422 });
  }

  const displayLabel = `[${profile.id}] ${profile.username}`;

  const { error: insertError } = await supabase
    .from("tournament_players")
    .upsert(
      {
        tournament_id: tournament.id,
        user_id: profile.id,
        challonge_display_name: displayLabel,
      },
      { onConflict: "tournament_id,user_id" },
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
