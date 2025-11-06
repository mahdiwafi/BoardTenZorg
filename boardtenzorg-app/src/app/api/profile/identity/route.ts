import { NextResponse } from "next/server";

import {
  ensureProfileRecord,
  findUserByUsername,
  type SupabaseServerClient,
} from "@/lib/boardtenzorg";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_PATTERN, USERNAME_REQUIREMENTS } from "@/lib/constants/username";

type IdentityRequestBody = {
  username?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();

  if (!session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: IdentityRequestBody;
  try {
    payload = (await request.json()) as IdentityRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawUsername = payload.username?.trim().toLowerCase();
  if (!rawUsername || !USERNAME_PATTERN.test(rawUsername)) {
    return NextResponse.json({ error: USERNAME_REQUIREMENTS }, { status: 422 });
  }

  try {
    const duplicate = await findUserByUsername(supabase, rawUsername);
    if (duplicate && duplicate.auth_user_id !== session.user.id) {
      return NextResponse.json({ error: "Username already taken." }, { status: 409 });
    }

    const profile = await ensureProfileRecord(supabase, session.user.id);

    if (profile.username !== rawUsername) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ username: rawUsername })
        .eq("id", profile.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    await ensureActiveSeasonRating(supabase, profile.id);

    return NextResponse.json({ id: profile.id, username: rawUsername });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ensureActiveSeasonRating(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data: activeSeason, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonError) {
    throw new Error(seasonError.message);
  }

  if (!activeSeason) {
    return;
  }

  const { error: ratingError } = await supabase
    .from("player_season_ratings")
    .upsert(
      {
        user_id: userId,
        season_id: activeSeason.id,
      },
      { onConflict: "user_id,season_id", ignoreDuplicates: true },
    );

  if (ratingError) {
    throw new Error(ratingError.message);
  }
}
