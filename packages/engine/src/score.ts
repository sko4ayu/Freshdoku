/**
 * Points and stars for a finished level. There is no time component.
 *
 *   base    = 100 x difficulty grade (1 to 10)
 *   penalty = 20% of base per mistake, 10% per hint
 *   floor   = 20% of base
 */
export const SCORE_PER_GRADE = 100;
export const MISTAKE_PENALTY = 0.2;
export const HINT_PENALTY = 0.1;
export const SCORE_FLOOR = 0.2;

export function levelScore(difficulty: number, mistakes: number, hints: number): number {
  const base = SCORE_PER_GRADE * difficulty;
  const factor = Math.max(SCORE_FLOOR, 1 - MISTAKE_PENALTY * mistakes - HINT_PENALTY * hints);
  return Math.round(base * factor);
}

/** 3 stars: no mistakes and no hints. 2: one mistake, or hints only. 1: anything else. */
export function levelStars(mistakes: number, hints: number): 1 | 2 | 3 {
  if (mistakes === 0 && hints === 0) return 3;
  if ((mistakes === 1 && hints === 0) || (mistakes === 0 && hints > 0)) return 2;
  return 1;
}
