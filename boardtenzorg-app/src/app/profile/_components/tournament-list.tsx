"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { TournamentWithRegistration } from "@/lib/boardtenzorg";

type TournamentListProps = {
  tournaments: TournamentWithRegistration[];
};

export function TournamentList({ tournaments }: TournamentListProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRegister(tournamentId: string) {
    if (!tournamentId) {
      setError("Tournament id missing.");
      return;
    }

    setPending(tournamentId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to register.");
      }

      setMessage("Registered!");
      router.refresh();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Unexpected error.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {tournaments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No tournaments scheduled yet this month. Check back soon.
        </div>
      ) : (
        tournaments.map((tournament) => (
          <div
            key={tournament.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{tournament.name}</p>
              <p className="text-xs text-muted-foreground">
                Challonge:{" "}
                <a href={tournament.challonge_url} target="_blank" rel="noreferrer" className="underline">
                  {tournament.challonge_slug ?? tournament.challonge_url}
                </a>
              </p>
              <p className="mt-1 text-xs uppercase text-muted-foreground">
                Status: {tournament.state} • Registered players: {tournament.player_count}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleRegister(tournament.id)}
                disabled={tournament.isRegistered || tournament.state !== "registered" || pending === tournament.id}
              >
                {tournament.isRegistered ? "Registered" : pending === tournament.id ? "Joining..." : "Register"}
              </Button>
            </div>
          </div>
        ))
      )}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
