import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/boardtenzorg";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  let profile = null;
  try {
    profile = await getCurrentUserProfile();
  } catch {
    profile = null;
  }
  const fallbackLabel = user.email ?? "Player";
  const displayLabel = profile?.username ?? profile?.id ?? fallbackLabel;

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/profile" className="font-medium hover:underline">
        {profile ? displayLabel : fallbackLabel}
      </Link>
      <span className="text-border">|</span>
      <LogoutButton />
    </div>
  );
}
