"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type RateTournamentButtonProps = {
  tournamentId: string;
  state: "registered" | "rated";
};

async function invokeRate(tournamentId: string, rerun: boolean) {
  const response = await fetch(`/api/tournaments/${tournamentId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rerun }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to trigger rating job.");
  }
}

export function RateTournamentButton({ tournamentId, state }: RateTournamentButtonProps) {
  const [isRating, setIsRating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRate(rerun: boolean) {
    setIsRating(true);
    setError(null);
    try {
      await invokeRate(tournamentId, rerun);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsRating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => handleRate(false)} disabled={isRating}>
          {isRating ? "Starting job..." : "Finish & calculate"}
        </Button>
        {state === "rated" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleRate(true)}
            disabled={isRating}
          >
            Re-run Elo
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
