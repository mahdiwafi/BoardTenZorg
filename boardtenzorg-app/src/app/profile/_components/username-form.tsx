"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import {
  USERNAME_HELP_TEXT,
  USERNAME_PATTERN,
  USERNAME_REQUIREMENTS,
} from "@/lib/constants/username";

type UsernameFormProps = {
  initialUsername: string | null;
};

export function UsernameForm({ initialUsername }: UsernameFormProps) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const router = useRouter();

  const isDirty = useMemo(() => {
    return username.trim().toLowerCase() !== (initialUsername ?? "").toLowerCase();
  }, [username, initialUsername]);

  const {
    error,
    isLoading,
    result: successMessage,
    run: submitUsername,
    reset,
  } = useAsyncAction(async (nextUsername: string) => {
    const response = await fetch("/api/profile/identity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: nextUsername }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to save username.");
    }

    router.refresh();
    return "Profile updated.";
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitUsername(username.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(event) => {
            if (error || successMessage) {
              reset();
            }
            setUsername(event.target.value);
          }}
          placeholder="lowercase, 3-20 chars"
          required
          pattern={USERNAME_PATTERN.source}
          title={USERNAME_REQUIREMENTS}
          minLength={3}
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">{USERNAME_HELP_TEXT}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}

      <Button type="submit" disabled={isLoading || !isDirty}>
        {isLoading ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
