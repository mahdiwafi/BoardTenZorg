"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

export function CreateTournamentForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const router = useRouter();

  const {
    error,
    isLoading,
    result: successMessage,
    run: submitTournament,
    reset,
  } = useAsyncAction(
    async ({ name, url }: { name: string; url: string }) => {
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

      router.refresh();
      return "Tournament created.";
    },
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = await submitTournament({ name, url });
    if (outcome) {
      setName("");
      setUrl("");
    }
  }

  const handleFieldChange =
    (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
      if (error || successMessage) {
        reset();
      }
      setter(event.target.value);
    };

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
            onChange={handleFieldChange(setName)}
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
            onChange={handleFieldChange(setUrl)}
            required
            placeholder="https://challonge.com/boardtenzorg-test"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save tournament"}
      </Button>
    </form>
  );
}
