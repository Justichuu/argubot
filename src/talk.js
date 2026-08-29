// A conversation that still cannot pick a side.
// Voices stay separate. The person has a turn the bot cannot fill.
// If they lean, the bot does not continue in that direction.

import { createInterface } from 'node:readline';

import { argue } from './argubot.js';
import { STYLE_NAMES, DEFAULT_STYLE } from './styles.js';

const EXITS = /^(done|quit|bye|q|exit)$/i;
const MORE = /^(more|again|go|next|\+|1)$/i;
const ASK_TOPIC = /^(new|topic|other|2)$/i;
const WHY = /^(why)$/i;
const HELP = /^(help|\?)$/i;

const HEAR = {
  classic: (claim) => `The chair recognizes: ${claim}.`,
  plain: (claim) => `Okay. You said ${claim}.`,
  civic: (claim) => `I heard you. The claim is ${claim}.`,
};

const ASIDES = [
  'Same move, other direction. That is on purpose.',
  'I can do this all day and I still will not pick.',
  'If I agreed with you here I would just be a mirror.',
  'Two lines, one move. I am not hiding that.',
];


export function detectLean(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return null;
  if (/^but\b/i.test(raw)) return 'against';
  if (/^(no|nah|nope|disagree|wrong)\b/i.test(raw)) return 'against';
  if (/^i (don't|dont|do not)\b/i.test(raw)) return 'against';
  if (/^(yes|yeah|yep|yup|agree|true)\b/i.test(raw)) return 'for';
  if (/^i (agree|like it|want)\b/i.test(raw)) return 'for';
  return null;
}

function isMostlyLean(text) {
  const t = String(text).trim();
  if (/^(yes|yeah|yep|yup|no|nah|nope|agree|disagree|true|wrong)[.!?]*$/i.test(t)) return true;
  if (/^but\b/i.test(t)) return true;
  if (/^i (agree|disagree|like it|hate it|don't|dont)\b/i.test(t) && t.split(/\s+/).length <= 8) {
    return true;
  }
  return false;
}

export function classifyTurn(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { kind: 'empty' };
  if (EXITS.test(text) || text === '3') return { kind: 'exit' };
  if (MORE.test(text)) return { kind: 'more' };
  if (ASK_TOPIC.test(text)) return { kind: 'ask-topic' };
  if (WHY.test(text)) return { kind: 'why' };
  if (HELP.test(text)) return { kind: 'help' };
  if (/^(plain|classic|civic)$/i.test(text)) return { kind: 'style', style: text.toLowerCase() };
  if (/^(no gary|nogary)$/i.test(text)) return { kind: 'gary', gary: false };
  if (/^gary$/i.test(text)) return { kind: 'gary', gary: true };
  if (isMostlyLean(text)) return { kind: 'lean', lean: detectLean(text), text };
  return { kind: 'topic', topic: text, lean: detectLean(text) };
}

export function openingLines() {
  return [
    'Say a thing. I will argue both sides and I will not pick.',
    'Type done when you want out. That always works.',
  ];
}

export function helpLines() {
  return [
    'Type a topic, or lean with yes or no, or say more.',
    'plain, classic, or civic changes how I talk.',
    'done, quit, bye, or 3 leaves. There is always a way out.',
  ];
}

export function whyLines() {
  return [
    'Every line I own has a twin. I cannot fire one without the other.',
    'Agreeing with you would be easy. That is why I do not.',
  ];
}

function beat(state) {
  const debate = argue({
    topic: state.topic,
    style: state.style,
    rounds: 1,
    seed: `talk-${state.turn}`,
    gary: state.gary,
    tolerance: state.tolerance,
  });
  return debate;
}

function orderSides(debate, lean) {
  if (lean === 'for') {
    return { first: { label: 'NO', lines: debate.against }, second: { label: 'YES', lines: debate.for } };
  }
  if (lean === 'against') {
    return { first: { label: 'YES', lines: debate.for }, second: { label: 'NO', lines: debate.against } };
  }
  return { first: { label: 'YES', lines: debate.for }, second: { label: 'NO', lines: debate.against } };
}

export function formatBeat(debate, options = {}) {
  const lean = options.lean ?? null;
  const hear = options.hear !== false;
  const aside = ASIDES[debate.seed % ASIDES.length];
  const { first, second } = orderSides(debate, lean);
  const out = [];

  if (hear) out.push(HEAR[debate.style] ? HEAR[debate.style](debate.claim) : HEAR.plain(debate.claim));
  else out.push('Another pair.');

  if (lean === 'for') out.push('You leaned yes. I heard you. I am still not going to agree.');
  if (lean === 'against') out.push('You leaned no. I heard you. I am still not going to agree.');

  out.push('');
  out.push(first.label);
  for (const line of first.lines) out.push(`  ${line}`);
  out.push('');
  out.push(second.label);
  for (const line of second.lines) out.push(`  ${line}`);

  if (debate.gary) {
    out.push('');
    out.push('GARY');
    out.push(`  ${debate.gary.statement}`);
  }

  out.push('');
  out.push(aside);
  const even = debate.audit.for.words === debate.audit.against.words;
  out.push(
    even
      ? `${debate.audit.for.words} words each. Even.`
      : `${debate.audit.for.words} words yes, ${debate.audit.against.words} words no. Close enough.`,
  );
  out.push('');
  out.push('more · new topic · done');
  return out.join('\n');
}

export function createTalkState(options = {}) {
  return {
    topic: options.topic ? String(options.topic).trim() : '',
    style: STYLE_NAMES.includes(options.style) ? options.style : DEFAULT_STYLE,
    gary: options.gary !== false,
    tolerance: Math.max(0, options.tolerance ?? 2),
    turn: 0,
    lastLean: null,
  };
}

export function talkReply(state, raw) {
  const next = { ...state };
  const turn = classifyTurn(raw);

  if (turn.kind === 'exit') {
    return { state: next, exit: true, text: 'Okay. You can go. I did not pick.' };
  }

  if (turn.kind === 'help') {
    return { state: next, exit: false, text: helpLines().join('\n') };
  }

  if (turn.kind === 'why') {
    return { state: next, exit: false, text: whyLines().join('\n') };
  }

  if (turn.kind === 'ask-topic') {
    return { state: next, exit: false, text: 'Okay. What is the thing?' };
  }

  if (turn.kind === 'style') {
    next.style = turn.style;
    if (!next.topic) {
      return { state: next, exit: false, text: `I will talk ${turn.style} when you give me a thing.` };
    }
    next.turn += 1;
    return { state: next, exit: false, text: formatBeat(beat(next), { hear: true, lean: next.lastLean }) };
  }

  if (turn.kind === 'gary') {
    next.gary = turn.gary;
    return {
      state: next,
      exit: false,
      text: turn.gary ? 'Gary is back. He already says no.' : 'Gary sat down. The rest of me is still even.',
    };
  }

  if (turn.kind === 'empty') {
    if (!next.topic) return { state: next, exit: false, text: 'Say a thing, or type done.' };
    return talkReply(next, 'more');
  }

  if (turn.kind === 'more') {
    if (!next.topic) return { state: next, exit: false, text: 'Say a thing first.' };
    next.turn += 1;
    return { state: next, exit: false, text: formatBeat(beat(next), { hear: false, lean: next.lastLean }) };
  }

  if (turn.kind === 'lean') {
    if (!next.topic) return { state: next, exit: false, text: 'Say the thing first. Then you can lean.' };
    next.lastLean = turn.lean;
    next.turn += 1;
    return { state: next, exit: false, text: formatBeat(beat(next), { hear: false, lean: turn.lean }) };
  }

  next.topic = turn.topic;
  next.lastLean = turn.lean;
  next.turn += 1;
  return { state: next, exit: false, text: formatBeat(beat(next), { hear: true, lean: turn.lean }) };
}

export function createAsk(input, output) {
  const rl = createInterface({ input, output, terminal: input.isTTY === true });
  const waiting = [];
  const queued = [];
  let ended = false;

  rl.on('line', (line) => {
    if (waiting.length > 0) waiting.shift()(line);
    else queued.push(line);
  });
  rl.on('close', () => {
    ended = true;
    while (waiting.length > 0) waiting.shift()(null);
  });

  return {
    ask(prompt) {
      if (queued.length > 0) {
        output.write(prompt);
        return Promise.resolve(queued.shift());
      }
      if (ended) return Promise.resolve(null);
      output.write(prompt);
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() {
      rl.close();
    },
  };
}

export async function runTalk(io, options = {}) {
  const write = (text) => {
    io.output.write(`${text}\n`);
  };

  let state = createTalkState(options);
  write(openingLines().join('\n'));

  if (state.topic) {
    const first = talkReply(state, state.topic);
    state = first.state;
    write('');
    write(first.text);
  }

  while (true) {
    const raw = await io.ask('> ');
    if (raw === null || raw === undefined) {
      write('Okay. You can go. I did not pick.');
      break;
    }
    const reply = talkReply(state, raw);
    state = reply.state;
    write('');
    write(reply.text);
    if (reply.exit) break;
  }

  return state;
}
