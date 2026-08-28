const CODES = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

function makePaint(useColor) {
  return (code, text) => (useColor ? `${CODES[code]}${text}${CODES.reset}` : text);
}

// Wraps plain text to `width`, prefixing every line with `indent`. Colour is
// applied afterwards so escape codes never count towards the line length.
function block(text, width, indent = '') {
  const limit = Math.max(8, width - indent.length);
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current === '') {
      current = word;
    } else if (`${current} ${word}`.length <= limit) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines.map((line) => `${indent}${line}`);
}

export function render(debate, options = {}) {
  const useColor = options.color !== false;
  const paint = makePaint(useColor);
  const width = Math.max(48, Math.min(options.width ?? 88, 120));
  const out = [];

  const pushBlock = (text, indent, code) => {
    for (const line of block(text, width, indent)) out.push(code ? paint(code, line) : line);
  };

  out.push('');
  pushBlock(`THE QUESTION OF ${debate.claim.toUpperCase()}`, '', 'bold');
  pushBlock(
    `seed ${debate.seed} · ${debate.rounds} round(s) · sides argued: both, equally, on purpose`,
    '',
    'dim',
  );
  out.push('');

  const pushSide = (label, lines, code) => {
    out.push(paint(code, label));
    lines.forEach((line, index) => {
      const wrapped = block(line, width, '      ');
      const label = `${String(index + 1).padStart(2)}.`;
      wrapped[0] = `  ${paint(code, label)} ${wrapped[0].trimStart()}`;
      out.push(...wrapped);
    });
    out.push('');
  };

  pushSide('FOR', debate.for, 'green');
  pushSide('AGAINST', debate.against, 'red');

  if (debate.gary) {
    out.push(paint('yellow', 'GARY (independent)'));
    pushBlock(debate.gary.statement, '  ');
    pushBlock(debate.gary.footnote, '  ', 'dim');
    out.push('');
  }

  const { audit } = debate;
  out.push(paint('cyan', 'BIAS AUDIT'));
  const status = audit.balanced ? 'BALANCED' : 'IMBALANCED';
  const summary =
    `words ${audit.for.words} for / ${audit.against.words} against · ` +
    `delta ${audit.wordDelta} (tolerance ${audit.tolerance}) · ${status}`;
  for (const line of block(summary, width, '  ')) {
    out.push(line.replace(status, paint(audit.balanced ? 'green' : 'red', status)));
  }
  pushBlock(
    `hedges ${audit.for.hedges}/${audit.against.hedges} · ` +
      `intensifiers ${audit.for.intensifiers}/${audit.against.intensifiers} · ` +
      'rhetorical moves reused on both sides: all of them',
    '  ',
    'dim',
  );
  out.push('');

  pushBlock(debate.moderator, '  ', 'dim');
  const verdict = block(debate.verdict, width, '           ');
  verdict[0] = `  ${paint('bold', 'VERDICT:')} ${verdict[0].trimStart()}`;
  out.push(...verdict);
  out.push('');

  return out.join('\n');
}
