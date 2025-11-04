"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTournamentForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          challongeUrl: url,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to create tournament.");
      }

      setSuccess("Tournament created.");
      setName("");
      setUrl("");
      router.refresh();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold">Register Challonge tournament</h3>
        <p className="text-sm text-muted-foreground">
          Store the bracket so we can fetch results once it is complete.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="space-y-2">
          <Label htmlFor="tournament-name">Display name</Label>
          <Input
            id="tournament-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={3}
            placeholder="BoardTenZorg Weekly #42"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tournament-url">Challonge URL</Label>
          <Input
            id="tournament-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
            placeholder="https://challonge.com/boardtenzorg-test"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-500">{success}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save tournament"}
      </Button>
    </form>
  );
}
