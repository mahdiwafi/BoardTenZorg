"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

export function FinalizeSeasonButton() {
  const router = useRouter();

  const {
    error,
    isLoading,
    result: successMessage,
    run: finalizeSeason,
  } = useAsyncAction(async () => {
    const response = await fetch("/api/seasons/finalize", {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to finalize season.");
    }

    router.refresh();
    return "Season finalized. Remember to create the next season via cron or manually.";
  });

  async function handleFinalize() {
    await finalizeSeason();
  }

  return (
    <div className="space-y-2">
      <Button variant="destructive" onClick={handleFinalize} disabled={isLoading}>
        {isLoading ? "Finalizing..." : "Finalize season"}
      </Button>
      {successMessage ? <p className="text-xs text-muted-foreground">{successMessage}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
