const RATING_FLOOR = 1000;
const DEFAULT_K0 = 28;
const MAX_SINGLE_DELTA = 1000;

export type EloStage = "RR" | "DE_UB" | "DE_LB" | "GF";

export type EloContext = {
  entrantsCount: number;
  stage: EloStage;
  scoreGap: number;
  topRating: number;
  baseK?: number;
};

export type ApplyEloInput = {
  ratingA: number;
  ratingB: number;
  scoreA: 0 | 1;
  context: EloContext;
};

export type ApplyEloResult = {
  deltaA: number;
  deltaB: number;
  newRatingA: number;
  newRatingB: number;
};

/**
 * Applies the BoardTenZorg Elo specification (v6) to a single pairing.
 */
export function applyElo({ ratingA, ratingB, scoreA, context }: ApplyEloInput): ApplyEloResult {
  const scoreB = 1 - scoreA;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  const entrantsFactor = eventSizeFactor(context.entrantsCount);
  const marginFactor = marginFactorFromGap(context.scoreGap);
  const topRating = Math.max(context.topRating, RATING_FLOOR);
  const baseK = context.baseK ?? DEFAULT_K0;

  const effectiveKA = baseK * entrantsFactor * stageFactor(context.stage, ratingA) * marginFactor;
  const effectiveKB = baseK * entrantsFactor * stageFactor(context.stage, ratingB) * marginFactor;

  const rawDeltaA = effectiveKA * (scoreA - expectedA);
  const rawDeltaB = effectiveKB * (scoreB - expectedB);

  const adjustedDeltaA = applySignDamping(rawDeltaA, ratingA, topRating);
  const adjustedDeltaB = applySignDamping(rawDeltaB, ratingB, topRating);

  const deltaA = clampDelta(Math.round(adjustedDeltaA));
  const deltaB = clampDelta(Math.round(adjustedDeltaB));

  return {
    deltaA,
    deltaB,
    newRatingA: Math.max(RATING_FLOOR, ratingA + deltaA),
    newRatingB: Math.max(RATING_FLOOR, ratingB + deltaB),
  };
}

export function eventSizeFactor(entrantsCount: number): number {
  if (!Number.isFinite(entrantsCount) || entrantsCount <= 0) {
    return 1;
  }
  const raw = Math.sqrt(entrantsCount) / 4;
  return clamp(raw, 1, 1.5);
}

export function stageFactor(stage: EloStage, rating: number): number {
  const base =
    stage === "DE_UB" ? 1.05 : stage === "DE_LB" ? 1.1 : stage === "GF" ? 1.15 : 1.0;
  const t = clamp((rating - RATING_FLOOR) / 1000, 0, 1);
  const eloScale = 1 - 0.7 * t; // tapers from 1.0 down to ~0.3 near 2000
  return 1 + (base - 1) * eloScale;
}

export function marginFactorFromGap(scoreGap: number): number {
  const gap = Math.max(1, Number.isFinite(scoreGap) ? scoreGap : 1);
  return Math.min(1 + 0.25 * Math.max(0, gap - 1), 2);
}

export function gainFactor(rating: number, topRating: number): number {
  const rTopEff = Math.max(topRating, 1500);
  const rLo = 1200;
  const rMid = (rLo + rTopEff) / 2;

  if (rating < rLo) {
    return 0.8 + 0.2 * ((rating - RATING_FLOOR) / (rLo - RATING_FLOOR));
  }
  if (rating <= rMid) {
    return 1;
  }
  if (rating <= rTopEff) {
    return 1 - 0.7 * ((rating - rMid) / (rTopEff - rMid));
  }
  return 0.2;
}

export function lossFactor(rating: number, topRating: number): number {
  const rTopEff = Math.max(topRating, 1500);
  const rLo = 1200;
  const rMid = (rLo + rTopEff) / 2;

  if (rating < rLo) {
    return 0.3 + 0.7 * ((rating - RATING_FLOOR) / (rLo - RATING_FLOOR));
  }
  if (rating <= rMid) {
    return 1;
  }
  if (rating <= rTopEff) {
    return 1 + 0.2 * ((rating - rMid) / (rTopEff - rMid));
  }
  return 1.2;
}

function applySignDamping(delta: number, rating: number, topRating: number) {
  return delta * (delta >= 0 ? gainFactor(rating, topRating) : lossFactor(rating, topRating));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampDelta(delta: number): number {
  return clamp(delta, -MAX_SINGLE_DELTA, MAX_SINGLE_DELTA);
}
