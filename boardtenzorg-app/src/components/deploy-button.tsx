import Link from "next/link";
import { Button } from "@/components/ui/button";

type DeployButtonProps = {
  href?: string;
};

/**
 * Lightweight placeholder for the Supabase deploy button included in the starter template.
 * Exposes the URL as a prop so downstream callers can customize destinations.
 */
export function DeployButton({
  href = "https://supabase.com/dashboard/projects",
}: DeployButtonProps) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href} target="_blank" rel="noreferrer">
        Deploy project
      </Link>
    </Button>
  );
}
