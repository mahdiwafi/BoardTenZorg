import { createClient } from "@/lib/supabase/server";

import type { Season } from "./types";

export async function getActiveSeasonId() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function getSeasonById(seasonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, status, start_at, end_at")
    .eq("id", seasonId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? ({ ...data } satisfies Season) : null;
}
