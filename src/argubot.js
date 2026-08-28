import { hashString, makeRng, pick, shuffled } from './rng.js';
import { FAMILIES } from './rhetoric.js';
import { getStyle, maxRounds, DEFAULT_STYLE, STYLE_NAMES } from './styles.js';
import { auditDebate, balance } from './audit.js';

export const DEFAULT_TOPIC = 'whether this sentence required an argument';
export const MAX_ROUNDS = FAMILIES.length;

export { STYLE_NAMES, DEFAULT_STYLE, maxRounds };

export function normalizeClaim(topic, styleName = DEFAULT_STYLE) {
  const style = getStyle(styleName);
  const trimmed = String(topic ?? '').trim().replace(/[.!?]+$/, '');
  if (trimmed === '') return style.defaultTopic;
  const claim = style.shapeClaim(trimmed);
  return claim.trim() === '' ? style.defaultTopic : claim;
}

export function argue(options = {}) {
  const styleName = STYLE_NAMES.includes(options.style) ? options.style : DEFAULT_STYLE;
  const style = getStyle(styleName);
  const topic = options.topic ?? style.defaultTopic;
  const claim = normalizeClaim(topic, styleName);
  const rounds = Math.max(1, Math.min(options.rounds ?? 3, style.families.length));
  const tolerance = Math.max(0, options.tolerance ?? 2);
  const includeGary = options.gary !== false;
  const seed =
    options.seed === undefined ? hashString(`${styleName}:${claim}`) : hashString(`${styleName}:${claim}:${options.seed}`);

  const rng = makeRng(seed);
  const families = shuffled(rng, style.families).slice(0, rounds);

  const raw = {
    for: families.map((family) => family.for(claim)),
    against: families.map((family) => family.against(claim)),
  };

  const balanced = balance(raw.for, raw.against, rng, tolerance, style.flourishes);
  const audit = auditDebate(balanced.for, balanced.against, tolerance);

  // Drawn unconditionally so that hiding Gary does not reshuffle everything else.
  const garyFootnote = pick(rng, style.garyFootnotes);

  return {
    claim,
    style: styleName,
    seed,
    rounds: families.length,
    moves: families.map((family) => family.move),
    for: balanced.for,
    against: balanced.against,
    gary: includeGary ? { name: 'Gary', statement: 'No.', footnote: garyFootnote } : null,
    moderator: pick(rng, style.moderatorLines),
    verdict: pick(rng, style.verdictLines),
    audit,
  };
}
