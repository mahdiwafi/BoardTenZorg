"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ParticipantsExportProps = {
  tournamentId: string;
};

export function ParticipantsExport({ tournamentId }: ParticipantsExportProps) {
  const [isLoading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
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
        setMessage("Copied to clipboard.");
      } else {
        setMessage("List generated. Copy manually:");
        console.info(text);
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
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
