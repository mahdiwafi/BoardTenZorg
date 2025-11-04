"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function FinalizeSeasonButton() {
  const [isFinalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/seasons/finalize", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to finalize season.");
      }

      setSuccess("Season finalized. Remember to create the next season via cron or manually.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="destructive" onClick={handleFinalize} disabled={isFinalizing}>
        {isFinalizing ? "Finalizing..." : "Finalize season"}
      </Button>
      {success ? <p className="text-xs text-muted-foreground">{success}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
