import { differenceInDays } from 'date-fns';

// Decay rate: ~5 weeks half-life (ln(2) / 35 ≈ 0.0198)
const DECAY_RATE = 0.02;

/**
 * Calculate the live (current) usage score with decay applied.
 */
export function getLiveUsageScore(usageScore: number | undefined, lastUsageAt: number | undefined): number {
  if (!usageScore || !lastUsageAt) return 0;

  const daysSinceLastUsage = differenceInDays(Date.now(), lastUsageAt);
  return usageScore * Math.exp(-DECAY_RATE * daysSinceLastUsage);
}

/**
 * Calculate updated score after a new usage event.
 * Returns the new score and timestamp.
 */
export function increaseUsageScore(
  currentScore: number,
  lastUsageAt: number,
): { usageScore: number; lastUsageAt: number } {
  const now = Date.now();

  const daysSinceLastUsage = differenceInDays(now, lastUsageAt);
  const decayedScore = currentScore * Math.exp(-DECAY_RATE * daysSinceLastUsage);

  return {
    usageScore: decayedScore + 1,
    lastUsageAt: now,
  };
}
