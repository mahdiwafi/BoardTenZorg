import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type CreateTournamentBody = {
  name?: string;
  challongeUrl?: string;
};

function extractSlug(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.split("/").filter(Boolean);
    return pathname[pathname.length - 1] ?? null;
  } catch {
    return null;
  }
}

async function ensureAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, authorized: false };
  }

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  const isAdmin = (roles ?? []).some((row) => row.role === "admin");
  return { user, authorized: isAdmin };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  let payload: CreateTournamentBody;
  try {
    payload = (await request.json()) as CreateTournamentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = payload.name?.trim();
  const challongeUrl = payload.challongeUrl?.trim();

  if (!name || name.length < 3) {
    return NextResponse.json({ error: "Name must be at least 3 characters." }, { status: 422 });
  }

  if (!challongeUrl) {
    return NextResponse.json({ error: "Challonge URL is required." }, { status: 422 });
  }

  let auth;
  try {
    auth = await ensureAdmin(supabase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify admin role." },
      { status: 500 },
    );
  }

  if (!auth.authorized) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const slug = extractSlug(challongeUrl);
  if (!slug) {
    return NextResponse.json({ error: "Invalid Challonge URL." }, { status: 422 });
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonError) {
    return NextResponse.json({ error: seasonError.message }, { status: 500 });
  }

  if (!season) {
    return NextResponse.json({ error: "No active season. Create one before adding tournaments." }, { status: 409 });
  }

  const { error: insertError } = await supabase.from("tournaments").insert({
    name,
    challonge_url: challongeUrl,
    challonge_slug: slug,
    season_id: season.id,
    state: "registered",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
