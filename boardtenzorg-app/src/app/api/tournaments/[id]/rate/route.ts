import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RateBody = {
  rerun?: boolean;
};

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

  let payload: RateBody = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      payload = (await request.json()) as RateBody;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
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

  const parsed = new URL(request.url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const tournamentId = parts.length >= 4 ? parts[2] : "";

  if (!tournamentId) {
    return NextResponse.json({ error: "Invalid tournament id." }, { status: 400 });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  }

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const { error: invokeError } = await supabase.functions.invoke("tournament-rate", {
    body: {
      tournamentId: tournament.id,
      rerun: Boolean(payload.rerun),
    },
  });

  if (invokeError) {
    return NextResponse.json({ error: invokeError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
