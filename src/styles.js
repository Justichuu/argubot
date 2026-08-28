import {
  FAMILIES,
  MODERATOR_LINES,
  VERDICT_LINES,
  GARY_FOOTNOTES,
  FLOURISHES,
  LABELS,
} from './rhetoric.js';
import {
  PLAIN_FAMILIES,
  PLAIN_MODERATOR_LINES,
  PLAIN_VERDICT_LINES,
  PLAIN_GARY_FOOTNOTES,
  PLAIN_FLOURISHES,
  PLAIN_LABELS,
} from './plain.js';

const isClause = (text) => ['whether', 'if', 'that'].includes(text.split(/\s+/)[0].toLowerCase());

export const STYLES = {
  classic: {
    id: 'classic',
    description: 'debate-club voice, fake statistics, named logical fallacies',
    defaultTopic: 'whether this sentence required an argument',
    // Classic voice wraps a bare topic in a clause so the templates read formally.
    shapeClaim: (topic) => (isClause(topic) ? topic : `the matter of ${topic}`),
    families: FAMILIES,
    moderatorLines: MODERATOR_LINES,
    verdictLines: VERDICT_LINES,
    garyFootnotes: GARY_FOOTNOTES,
    flourishes: FLOURISHES,
    labels: LABELS,
  },
  plain: {
    id: 'plain',
    description: 'common language, short words, reasons a normal person would give',
    defaultTopic: 'whether this needed an argument at all',
    shapeClaim: (topic) => topic,
    families: PLAIN_FAMILIES,
    moderatorLines: PLAIN_MODERATOR_LINES,
    verdictLines: PLAIN_VERDICT_LINES,
    garyFootnotes: PLAIN_GARY_FOOTNOTES,
    flourishes: PLAIN_FLOURISHES,
    labels: PLAIN_LABELS,
  },
};

export const STYLE_NAMES = Object.keys(STYLES);

export const DEFAULT_STYLE = 'classic';

export function getStyle(name) {
  return STYLES[name] ?? STYLES[DEFAULT_STYLE];
}

export function maxRounds(name) {
  return getStyle(name).families.length;
}
