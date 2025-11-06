"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

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
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"finish" | "rerun" | null>(null);

  const {
    error,
    isLoading,
    run: triggerRating,
  } = useAsyncAction(async ({ rerun }: { rerun: boolean }) => {
    await invokeRate(tournamentId, rerun);
    router.refresh();
  });

  async function handleRate(rerun: boolean) {
    setPendingAction(rerun ? "rerun" : "finish");
    await triggerRating({ rerun });
  }

  const isPending = (action: "finish" | "rerun") => isLoading && pendingAction === action;

  function getButtonLabel(action: "finish" | "rerun") {
    if (!isPending(action)) {
      return action === "finish" ? "Finish & calculate" : "Re-run Elo";
    }

    return action === "finish" ? "Starting job..." : "Re-running...";
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => handleRate(false)} disabled={isPending("finish")}>
          {getButtonLabel("finish")}
        </Button>
        {state === "rated" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleRate(true)}
            disabled={isPending("rerun")}
          >
            {getButtonLabel("rerun")}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
