#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { argue, maxRounds, STYLE_NAMES, DEFAULT_STYLE } from '../src/argubot.js';
import { STYLES } from '../src/styles.js';
import { formatLineage } from '../src/lineage.js';
import { render } from '../src/render.js';
import { createAsk, runTalk } from '../src/talk.js';
import { parseArgs, formatCommandList, COMMANDS } from '../src/commands.js';
import { burrito, renderBurrito } from '../src/burrito.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

const HELP = `argubot -- a funny, aggressively nonbiased argument bot

Usage:
  argubot [topic...] [options]
  argubot /command [topic...] [options]
  argubot command [topic...] [options]
  echo "a topic" | argubot [options]

Commands (slash or bare):
${formatCommandList()}

Options:
  -r, --rounds <n>       arguments per side (default 3; max is the style's pair count)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
  -w, --width <n>        wrap width for rendered text
      --style <name>     ${STYLE_NAMES.join(' | ')} (default ${DEFAULT_STYLE})
  -p, --plain            shorthand for --style plain
      --civic            shorthand for --style civic
      --classic          shorthand for --style classic
  -i, --talk             same as /talk
      --burrito          same as /burrito
  -d, --dissent          add a third voice that only says no (off by default)
      --no-dissent       keep the third voice out (default)
      --name <word>      turn dissent on and set the name
      --json             print structured output
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version

Styles:
${STYLE_NAMES.map((name) => `  ${name.padEnd(8)} ${STYLES[name].description}`).join('\n')}

Round caps: ${STYLE_NAMES.map((name) => `${name} ${maxRounds(name)}`).join(' / ')}

Examples:
  argubot pineapple on pizza
  argubot /talk --plain
  argubot /burrito "whether hot dogs are sandwiches"
  argubot pineapple --dissent
  argubot /dissent pineapple --plain
  echo "standing desks" | argubot --json

The bot argues both sides from the same moves and will not pick a winner.
Dissent is off unless you ask. When it is on, the name is generated from
vowel sounds and consonants unless you pass --name. If dissent is off,
there is no name.
`;

async function topicFromStdin() {
  if (process.stdin.isTTY === true) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function fail(message) {
  process.stderr.write(`argubot: ${message}\n`);
  process.exit(2);
}

function debateOptions(options, topic) {
  return {
    topic: topic === '' ? undefined : topic,
    style: options.style,
    rounds: options.rounds,
    seed: options.seed,
    dissent: options.dissent,
    dissentName: options.dissentName,
    tolerance: options.tolerance,
  };
}

function writeDebate(debate, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(debate, null, 2)}\n`);
    return;
  }
  const color = options.color && process.stdout.isTTY === true && !process.env.NO_COLOR;
  process.stdout.write(`${render(debate, { color, width: options.width ?? process.stdout.columns ?? 88 })}\n`);
}

async function runMenu(options) {
  const asker = createAsk(process.stdin, process.stdout);
  const actions = COMMANDS.filter((command) => !['menu', 'argue'].includes(command.name));
  try {
    process.stdout.write('\nWhat do you want to do?\n\n');
    actions.forEach((action, index) => {
      process.stdout.write(`  ${index + 1}) ${action.name}  ${action.summary}\n`);
    });
    process.stdout.write(`  ${actions.length + 1}) quit\n`);
    const answer = String(await asker.ask('\nType a number and press Enter: ')).trim();
    if (answer === 'q' || answer === String(actions.length + 1)) {
      process.stdout.write('Okay. You can go. I did not pick.\n');
      return;
    }
    const action = actions[Number(answer) - 1];
    if (!action) {
      process.stdout.write('Not a valid choice.\n');
      return;
    }
    options.command = action.name;
    await dispatch(options);
  } finally {
    asker.close();
  }
}

async function dispatch(options) {
  if (options.help || options.command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (options.version || options.command === 'version') {
    process.stdout.write(`argubot ${VERSION}\n`);
    return;
  }
  if (options.command === 'commands') {
    process.stdout.write(`${formatCommandList()}\n`);
    return;
  }
  if (options.command === 'styles') {
    process.stdout.write(`${STYLE_NAMES.map((name) => `${name}  ${STYLES[name].description}`).join('\n')}\n`);
    return;
  }
  if (options.command === 'lineage') {
    process.stdout.write(formatLineage());
    return;
  }
  if (options.command === 'ready') {
    process.stdout.write(`${JSON.stringify({ status: 'ready' })}\n`);
    return;
  }
  if (options.command === 'validate') {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'validate.js')], { stdio: 'inherit' });
    process.exit(result.status ?? 1);
  }
  if (options.command === 'menu') {
    await runMenu(options);
    return;
  }

  if (!STYLE_NAMES.includes(options.style)) fail(`unknown style ${options.style}. Pick one of: ${STYLE_NAMES.join(', ')}`);
  if (!Number.isFinite(options.rounds) || options.rounds < 1) fail('--rounds needs a positive number');
  if (!Number.isFinite(options.tolerance) || options.tolerance < 0) fail('--tolerance needs a number of zero or more');
  if (options.width !== undefined && (!Number.isFinite(options.width) || options.width < 8)) {
    fail('--width needs a number of 8 or more');
  }

  if (options.command === 'talk') {
    const asker = createAsk(process.stdin, process.stdout);
    try {
      await runTalk(
        {
          output: process.stdout,
          ask: (prompt) => asker.ask(prompt),
        },
        debateOptions(options, options.topic),
      );
    } finally {
      asker.close();
    }
    return;
  }

  const topic = options.topic === '' ? await topicFromStdin() : options.topic;

  if (options.command === 'burrito') {
    const plate = burrito(debateOptions(options, topic));
    if (options.json) {
      process.stdout.write(`${JSON.stringify(plate, null, 2)}\n`);
      return;
    }
    const color = options.color && process.stdout.isTTY === true && !process.env.NO_COLOR;
    process.stdout.write(`${renderBurrito(plate, { color, width: options.width ?? process.stdout.columns ?? 88 })}\n`);
    return;
  }

  writeDebate(argue(debateOptions(options, topic)), options);
}

const options = parseArgs(process.argv.slice(2));
if (options.unknown) fail(`unknown option ${options.unknown}\nTry --help. Or argue about it.`);
await dispatch(options);
