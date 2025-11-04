/**
 * Minimal Elo helper shared between API and edge functions.
 * Keeps the calculation logic simple and easy to unit-test.
 */
export function applyElo({
  ratingA,
  ratingB,
  scoreA,
  kFactor = 32,
}: {
  ratingA: number;
  ratingB: number;
  scoreA: 0 | 1;
  kFactor?: number;
}) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const deltaA = Math.round(kFactor * (scoreA - expectedA));
  const newRatingA = ratingA + deltaA;
  const newRatingB = ratingB - deltaA;

  return {
    deltaA,
    newRatingA,
    newRatingB,
  };
}
