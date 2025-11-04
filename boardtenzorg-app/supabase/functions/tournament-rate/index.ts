import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Payload = {
  tournamentId?: string;
  rerun?: boolean;
};

serve(async (request) => {
  try {
    const payload = (await request.json()) as Payload;
    if (!payload?.tournamentId) {
      return new Response(JSON.stringify({ error: "Missing tournamentId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `[tournament-rate] received tournamentId=${payload.tournamentId}, rerun=${Boolean(payload.rerun)}`,
    );

    // TODO: Implement Challonge fetch + Elo calculation.
    // Placeholder response ensures the API route succeeds until the full job is built.
    return new Response(
      JSON.stringify({
        ok: true,
        message: "tournament-rate stub ran successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[tournament-rate] unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
