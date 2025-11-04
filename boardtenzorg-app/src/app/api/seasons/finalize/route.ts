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

export async function POST() {
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
    return NextResponse.json({ error: "No active season to finalize." }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("seasons")
    .update({
      status: "finalized",
      end_at: new Date().toISOString(),
    })
    .eq("id", season.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
