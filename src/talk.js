// Conversation that still cannot pick a side. The person keeps a turn the bot cannot fill.

import { createInterface } from 'node:readline';

import { argue } from './argubot.js';
import { STYLE_NAMES, DEFAULT_STYLE } from './styles.js';
import { parseSlash, formatCommandList } from './commands.js';
import { burrito, renderBurrito } from './burrito.js';
import { generateName } from './names.js';
import { hashString, makeRng } from './rng.js';

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

const SLASH_KIND = {
  done: 'exit',
  quit: 'exit',
  exit: 'exit',
  bye: 'exit',
  help: 'help',
  why: 'why',
  more: 'more',
  commands: 'commands',
  burrito: 'burrito',
  all: 'burrito',
  full: 'burrito',
  styles: 'styles',
};

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

  const slash = parseSlash(text);
  if (slash) {
    if (SLASH_KIND[slash.command]) return { kind: SLASH_KIND[slash.command] };
    if (STYLE_NAMES.includes(slash.command)) return { kind: 'style', style: slash.command };
    if (slash.command === 'style' && STYLE_NAMES.includes(slash.args[0])) {
      return { kind: 'style', style: slash.args[0] };
    }
    if (slash.command === 'dissent') {
      if (slash.args[0] === 'off' || slash.args[0] === 'no') return { kind: 'dissent', dissent: false };
      return { kind: 'dissent', dissent: true };
    }
    if (slash.command === 'name') return { kind: 'name', name: slash.rest || undefined };
    if (slash.command === 'topic' && slash.rest) {
      return { kind: 'topic', topic: slash.rest, lean: detectLean(slash.rest) };
    }
    return { kind: 'unknown-command', command: slash.command };
  }

  if (EXITS.test(text) || text === '3') return { kind: 'exit' };
  if (MORE.test(text)) return { kind: 'more' };
  if (ASK_TOPIC.test(text)) return { kind: 'ask-topic' };
  if (WHY.test(text)) return { kind: 'why' };
  if (HELP.test(text)) return { kind: 'help' };
  if (/^(plain|classic|civic)$/i.test(text)) return { kind: 'style', style: text.toLowerCase() };
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
    '/style plain  /civic  /classic   change voice',
    '/dissent on   /dissent off       optional third voice, generated name',
    '/burrito                         every voice on this topic',
    '/commands                        the full list',
    '/done                            leave. That always works.',
  ];
}

export function whyLines() {
  return [
    'Every line I own has a twin. I cannot fire one without the other.',
    'Agreeing with you would be easy. That is why I do not.',
  ];
}

function beat(state) {
  return argue({
    topic: state.topic,
    style: state.style,
    rounds: 1,
    seed: state.seed === undefined ? `talk-${state.turn}` : `${state.seed}:${state.turn}`,
    dissent: state.dissent,
    dissentName: state.dissentName,
    tolerance: state.tolerance,
  });
}

function orderSides(debate, lean) {
  if (lean === 'for') {
    return { first: { label: 'NO', lines: debate.against }, second: { label: 'YES', lines: debate.for } };
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

  if (debate.dissent && debate.dissent.name) {
    out.push('');
    out.push(debate.dissent.name.toUpperCase());
    out.push(`  ${debate.dissent.statement}`);
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
    dissent: options.dissent === true || options.gary === true,
    dissentName: options.dissentName,
    tolerance: Math.max(0, options.tolerance ?? 2),
    seed: options.seed,
    turn: 0,
    lastLean: null,
  };
}

function dissentNameFor(state) {
  return state.dissentName || generateName(makeRng(hashString(`dissent-talk:${state.topic}:${state.turn}`)));
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
  if (turn.kind === 'commands') {
    return { state: next, exit: false, text: formatCommandList() };
  }
  if (turn.kind === 'styles') {
    return { state: next, exit: false, text: STYLE_NAMES.join('\n') };
  }
  if (turn.kind === 'unknown-command') {
    return { state: next, exit: false, text: `I do not know /${turn.command}. Try /commands.` };
  }
  if (turn.kind === 'dissent') {
    next.dissent = turn.dissent;
    if (!next.dissent) {
      next.dissentName = undefined;
      return { state: next, exit: false, text: 'Dissent is off. No name.' };
    }
    next.dissentName = dissentNameFor(next);
    return { state: next, exit: false, text: `Dissent is on. ${next.dissentName} says no.` };
  }
  if (turn.kind === 'name') {
    next.dissent = true;
    next.dissentName = turn.name || dissentNameFor(next);
    return { state: next, exit: false, text: `Dissent is on. ${next.dissentName} says no.` };
  }
  if (turn.kind === 'burrito') {
    if (!next.topic) return { state: next, exit: false, text: 'Say a thing first.' };
    const plate = burrito({
      topic: next.topic,
      seed: next.seed,
      dissent: next.dissent,
      dissentName: next.dissentName,
      tolerance: next.tolerance,
    });
    return { state: next, exit: false, text: renderBurrito(plate, { color: false }) };
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

// ponytail: queue incoming lines so stdin EOF cannot hang readline.question
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
