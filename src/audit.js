import { pick } from './rng.js';
import { FLOURISHES } from './rhetoric.js';

const HEDGES = ['roughly', 'allegedly', 'arguably', 'broadly', 'somewhat', 'perhaps', 'maybe', 'probably', 'more or less', 'pending'];
const INTENSIFIERS = ['every', 'never', 'always', 'entire', 'total', 'extremely', 'precisely', 'immaculate', 'tragically', 'exactly'];

export const countWords = (text) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

const countFrom = (haystack, needles) =>
  needles.reduce((total, needle) => {
    const matches = haystack.match(new RegExp(needle.replace(/ /g, '\\s+'), 'g'));
    return total + (matches ? matches.length : 0);
  }, 0);

export function measure(lines) {
  const text = lines.join(' ');
  const lower = text.toLowerCase();
  return {
    arguments: lines.length,
    words: countWords(text),
    hedges: countFrom(lower, HEDGES),
    intensifiers: countFrom(lower, INTENSIFIERS),
    questions: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
  };
}

// A side is only "lighter" by word count; every other metric is already mirrored
// because both sides are generated from the same rhetorical families.
export function auditDebate(forLines, againstLines, tolerance) {
  const forSide = measure(forLines);
  const againstSide = measure(againstLines);
  const delta = Math.abs(forSide.words - againstSide.words);
  return {
    tolerance,
    for: forSide,
    against: againstSide,
    wordDelta: delta,
    balanced: delta <= tolerance,
    heavierSide: delta === 0 ? null : forSide.words > againstSide.words ? 'for' : 'against',
  };
}

export function balance(forLines, againstLines, rng, tolerance, flourishes = FLOURISHES) {
  const sides = { for: forLines.slice(), against: againstLines.slice() };
  const flourishWords = flourishes.map((flourish) => ({ flourish, words: countWords(flourish) }));

  for (let guard = 0; guard < 64; guard += 1) {
    const forWords = measure(sides.for).words;
    const againstWords = measure(sides.against).words;
    const delta = Math.abs(forWords - againstWords);
    if (delta <= tolerance) break;

    const lighter = forWords < againstWords ? 'for' : 'against';
    const affordable = flourishWords.filter((candidate) => candidate.words <= delta);
    const chosen = affordable.length > 0 ? pick(rng, affordable) : flourishWords[0];

    const lines = sides[lighter];
    if (lines.length === 0) break;
    const target = lines.length - 1;
    lines[target] = lines[target].replace(/([.!?])$/, `${chosen.flourish}$1`);
  }

  return sides;
}
