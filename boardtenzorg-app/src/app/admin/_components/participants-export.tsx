"use client";

import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

type ParticipantsExportProps = {
  tournamentId: string;
};

export function ParticipantsExport({ tournamentId }: ParticipantsExportProps) {
  const {
    error,
    isLoading,
    result: message,
    run: exportParticipants,
  } = useAsyncAction(async () => {
    const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
      method: "GET",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to export list.");
    }

    const text = await response.text();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return "Copied to clipboard.";
    }

    console.info(text);
    return "List generated. Copy manually from the console output.";
  });

  async function handleExport() {
    await exportParticipants();
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
        {isLoading ? "Exporting..." : "Copy participants"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
