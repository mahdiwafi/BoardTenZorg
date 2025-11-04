"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UsernameFormProps = {
  initialUsername: string | null;
};

export function UsernameForm({ initialUsername }: UsernameFormProps) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const router = useRouter();

  const isDirty = useMemo(() => {
    return username.trim().toLowerCase() !== (initialUsername ?? "").toLowerCase();
  }, [username, initialUsername]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/profile/identity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to save username.");
      }

      setSuccess("Profile updated.");
      router.refresh();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="lowercase, 3-20 chars"
          required
          pattern="^[a-z0-9_]{3,20}$"
          minLength={3}
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, underscores. This will appear on leaderboards and match history.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-500">{success}</p> : null}

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
