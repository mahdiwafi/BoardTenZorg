import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  const parsed = new URL(request.url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const tournamentId = parts.length >= 4 ? parts[2] : "";

  if (!tournamentId) {
    return NextResponse.json({ error: "Invalid tournament id." }, { status: 400 });
  }
  const supabase = await createClient();

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

  const { data, error } = await supabase
    .from("tournament_players")
    .select("user_id, challonge_display_name, users(username)")
    .eq("tournament_id", tournamentId)
    .order("users(username)", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines = (data ?? []).map((row) => {
    if (row.challonge_display_name) {
      return row.challonge_display_name;
    }
    const username = row.users?.username ?? "Unknown";
    return `[${row.user_id}] ${username}`;
  });

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
