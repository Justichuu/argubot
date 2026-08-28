import { hashString, makeRng, pick, shuffled } from './rng.js';
import { FAMILIES, MODERATOR_LINES, VERDICT_LINES, GARY_FOOTNOTES } from './rhetoric.js';
import { auditDebate, balance } from './audit.js';

export const DEFAULT_TOPIC = 'whether this sentence required an argument';
export const MAX_ROUNDS = FAMILIES.length;

export function normalizeClaim(topic) {
  const trimmed = String(topic ?? '').trim();
  if (trimmed === '') return DEFAULT_TOPIC;
  const withoutTrailing = trimmed.replace(/[.!?]+$/, '');
  const firstWord = withoutTrailing.split(/\s+/)[0].toLowerCase();
  const alreadyAClause = ['whether', 'if', 'that'].includes(firstWord);
  const claim = alreadyAClause ? withoutTrailing : `the matter of ${withoutTrailing}`;
  return claim.length > 0 ? claim : DEFAULT_TOPIC;
}

export function argue(options = {}) {
  const topic = options.topic ?? DEFAULT_TOPIC;
  const claim = normalizeClaim(topic);
  const rounds = Math.max(1, Math.min(options.rounds ?? 3, MAX_ROUNDS));
  const tolerance = Math.max(0, options.tolerance ?? 2);
  const includeGary = options.gary !== false;
  const seed = options.seed === undefined ? hashString(claim) : hashString(`${claim}:${options.seed}`);

  const rng = makeRng(seed);
  const families = shuffled(rng, FAMILIES).slice(0, rounds);

  const raw = {
    for: families.map((family) => family.for(claim)),
    against: families.map((family) => family.against(claim)),
  };

  const balanced = balance(raw.for, raw.against, rng, tolerance);
  const audit = auditDebate(balanced.for, balanced.against, tolerance);

  // Drawn unconditionally so that hiding Gary does not reshuffle everything else.
  const garyFootnote = pick(rng, GARY_FOOTNOTES);

  return {
    claim,
    seed,
    rounds: families.length,
    moves: families.map((family) => family.move),
    for: balanced.for,
    against: balanced.against,
    gary: includeGary ? { name: 'Gary', statement: 'No.', footnote: garyFootnote } : null,
    moderator: pick(rng, MODERATOR_LINES),
    verdict: pick(rng, VERDICT_LINES),
    audit,
  };
}
