// The whole plate: every voice, the audit, optional dissent, no leftovers.

import { argue, normalizeClaim } from './argubot.js';
import { STYLE_NAMES, DEFAULT_STYLE, getStyle } from './styles.js';
import { render } from './render.js';
import { generateName } from './names.js';
import { hashString, makeRng } from './rng.js';

export function burrito(options = {}) {
  const styleName = STYLE_NAMES.includes(options.style) ? options.style : DEFAULT_STYLE;
  const topic = options.topic ?? getStyle(styleName).defaultTopic;
  const claim = normalizeClaim(topic, styleName);
  const dissentName =
    options.dissent === true
      ? options.dissentName || generateName(makeRng(hashString(`burrito:${claim}:${options.seed ?? ''}`)))
      : undefined;
  const servings = STYLE_NAMES.map((style) =>
    argue({
      topic,
      style,
      rounds: options.rounds,
      seed: options.seed,
      dissent: options.dissent,
      dissentName,
      tolerance: options.tolerance,
    }),
  );

  return {
    kind: 'burrito',
    claim,
    topic: topic,
    seed: servings[0]?.seed ?? 0,
    dissent: options.dissent === true,
    servings,
    ledger: servings.map((serving) => ({
      style: serving.style,
      wordsFor: serving.audit.for.words,
      wordsAgainst: serving.audit.against.words,
      delta: serving.audit.wordDelta,
      balanced: serving.audit.balanced,
      dissent: serving.dissent ? serving.dissent.name : null,
    })),
  };
}

export function renderBurrito(plate, options = {}) {
  const width = options.width;
  const color = options.color;
  const parts = [
    '',
    'BURRITO',
    `one topic, ${plate.servings.length} voices, both sides each, no winner`,
    plate.dissent ? 'dissent is on' : 'dissent is off (no name)',
    '',
  ];

  for (const serving of plate.servings) {
    parts.push(render(serving, { color, width }).trimEnd());
    parts.push('');
  }

  parts.push('LEDGER');
  for (const row of plate.ledger) {
    const dissent = row.dissent ? ` · ${row.dissent} said no` : '';
    parts.push(
      `  ${row.style}: ${row.wordsFor}/${row.wordsAgainst} words · gap ${row.delta} · ${
        row.balanced ? 'even' : 'leaning'
      }${dissent}`,
    );
  }
  parts.push('');
  return parts.join('\n');
}
