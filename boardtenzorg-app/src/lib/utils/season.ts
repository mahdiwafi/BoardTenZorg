const seasonDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export function formatSeasonLabel(
  startAt: string | null | undefined,
  fallbackId: string,
) {
  if (!startAt) {
    return fallbackId;
  }

  try {
    return seasonDateFormatter.format(new Date(startAt));
  } catch {
    return fallbackId;
  }
}

