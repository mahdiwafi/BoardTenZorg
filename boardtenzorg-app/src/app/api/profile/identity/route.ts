import { NextResponse } from "next/server";

import { generatePublicId } from "@/lib/id";
import { createClient } from "@/lib/supabase/server";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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

  const rawUsername = payload.username?.trim();
  if (!rawUsername || !USERNAME_PATTERN.test(rawUsername)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (lowercase letters, digits, underscores)." },
      { status: 422 },
    );
  }

  const username = rawUsername.toLowerCase();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("username", username)
    .maybeSingle();

  if (duplicateError) {
    return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  }

  if (duplicate && duplicate.auth_user_id !== session.user.id) {
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  let recordId = existing?.id;

  if (!existing) {
    let generatedId: string | null = null;

    for (let attempts = 0; attempts < 10; attempts += 1) {
      const candidate = generatePublicId(5);
      const { data: taken, error: takenError } = await supabase
        .from("users")
        .select("id")
        .eq("id", candidate)
        .maybeSingle();

      if (takenError) {
        return NextResponse.json({ error: takenError.message }, { status: 500 });
      }

      if (!taken) {
        generatedId = candidate;
        break;
      }
    }

    if (!generatedId) {
      return NextResponse.json({ error: "Could not generate user id." }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: generatedId,
      auth_user_id: session.user.id,
      username,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    recordId = generatedId;
  } else if (existing.username !== username) {
    const { error: updateError } = await supabase
      .from("users")
      .update({ username })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (!recordId) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }

  const { data: activeSeason, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonError) {
    return NextResponse.json({ error: seasonError.message }, { status: 500 });
  }

  if (activeSeason) {
    const { error: ratingError } = await supabase
      .from("player_season_ratings")
      .upsert(
        {
          user_id: recordId,
          season_id: activeSeason.id,
        },
        { onConflict: "user_id,season_id", ignoreDuplicates: true },
      );

    if (ratingError) {
      return NextResponse.json({ error: ratingError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: recordId, username });
}
