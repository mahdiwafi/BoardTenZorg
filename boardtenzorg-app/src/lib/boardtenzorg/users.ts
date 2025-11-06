import { createClient } from "@/lib/supabase/server";
import { generatePublicId } from "@/lib/id";

import type { ProfileRecord, PublicProfile, UserRoles } from "./types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();

  if (!session.user) {
    return null;
  }

  return ensureProfileRecord(supabase, session.user.id);
}

export async function getCurrentUserRoles() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();

  if (!session.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_user_id", session.user.id);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.role) as UserRoles[];
}

export async function getUserProfileById(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? ({
        id: data.id,
        username: data.username ?? null,
        created_at: data.created_at ?? null,
      } satisfies PublicProfile)
    : null;
}

export async function ensureProfileRecord(
  supabase: SupabaseServerClient,
  authUserId: string,
) {
  const existing = await fetchProfileByAuthId(supabase, authUserId);
  if (existing) {
    return existing;
  }

  let lastError: { message?: string } | null = null;
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const candidate = generatePublicId();
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        id: candidate,
        auth_user_id: authUserId,
      })
      .select("id, username")
      .maybeSingle();

    if (!insertError && inserted) {
      return {
        id: inserted.id,
        username: inserted.username ?? null,
      } satisfies ProfileRecord;
    }

    if (insertError?.code === "23505") {
      const profile = await fetchProfileByAuthId(supabase, authUserId);
      if (profile) {
        return profile;
      }
      lastError = insertError;
      continue;
    }

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  throw new Error(lastError?.message ?? "Could not assign player id.");
}

export async function fetchProfileByAuthId(
  supabase: SupabaseServerClient,
  authUserId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? ({ id: data.id, username: data.username ?? null } satisfies ProfileRecord)
    : null;
}

export async function findUserByUsername(
  supabase: SupabaseServerClient,
  username: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
