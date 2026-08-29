#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argue, maxRounds, STYLE_NAMES, DEFAULT_STYLE } from '../src/argubot.js';
import { STYLES } from '../src/styles.js';
import { formatLineage } from '../src/lineage.js';
import { render } from '../src/render.js';

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
  .version;

const HELP = `argubot -- a funny, aggressively nonbiased argument bot

Usage:
  argubot [topic...] [options]
  echo "a topic" | argubot [options]

Options:
  -r, --rounds <n>       arguments per side (default 3; max is the style's pair count)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
      --style <name>     ${STYLE_NAMES.join(' | ')} (default ${DEFAULT_STYLE})
  -p, --plain            shorthand for --style plain: common language, short words
      --civic            shorthand for --style civic: the book's public-draft voice
      --no-gary          hold the debate without Gary
      --json             print the debate as JSON
      --lineage          print the named catalog of borrowed Justichuu ideas
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version

Styles:
${STYLE_NAMES.map((name) => `  ${name.padEnd(8)} ${STYLES[name].description}`).join('\n')}

Round caps: ${STYLE_NAMES.map((name) => `${name} ${maxRounds(name)}`).join(' / ')}

Examples:
  argubot pineapple on pizza
  argubot pineapple on pizza --plain
  argubot pineapple on pizza --civic
  argubot "whether hot dogs are sandwiches" --rounds 5
  echo "standing desks" | argubot --json
  argubot --lineage

The bot argues both sides from the same rhetorical moves, audits itself for
word-count bias, and refuses to reach a conclusion. Gary just says no.
`;

function parseArgs(argv) {
  const options = { rounds: 3, gary: true, json: false, color: true, tolerance: 2, style: DEFAULT_STYLE };
  const words = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-p':
      case '--plain':
        options.style = 'plain';
        break;
      case '--civic':
        options.style = 'civic';
        break;
      case '--lineage':
        options.lineage = true;
        break;
      case '--style':
        options.style = argv[i + 1];
        i += 1;
        break;
      case '--no-gary':
        options.gary = false;
        break;
      case '--json':
        options.json = true;
        break;
      case '--no-color':
        options.color = false;
        break;
      case '-r':
      case '--rounds':
        options.rounds = Number.parseInt(argv[i + 1], 10);
        i += 1;
        break;
      case '-s':
      case '--seed':
        options.seed = argv[i + 1];
        i += 1;
        break;
      case '-t':
      case '--tolerance':
        options.tolerance = Number.parseInt(argv[i + 1], 10);
        i += 1;
        break;
      default:
        if (arg.startsWith('-') && arg.length > 1) {
          options.unknown = arg;
        } else {
          words.push(arg);
        }
    }
  }

  options.topic = words.join(' ');
  return options;
}

async function topicFromStdin() {
  if (process.stdin.isTTY === true) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (options.version) {
  process.stdout.write(`argubot ${VERSION}\n`);
  process.exit(0);
}

if (options.lineage) {
  process.stdout.write(formatLineage());
  process.exit(0);
}

const fail = (message) => {
  process.stderr.write(`argubot: ${message}\n`);
  process.exit(2);
};

if (options.unknown) fail(`unknown option ${options.unknown}\nTry --help. Or argue about it.`);
if (!STYLE_NAMES.includes(options.style)) fail(`unknown style ${options.style}. Pick one of: ${STYLE_NAMES.join(', ')}`);
if (!Number.isFinite(options.rounds) || options.rounds < 1) fail('--rounds needs a positive number');
if (!Number.isFinite(options.tolerance) || options.tolerance < 0) fail('--tolerance needs a number of zero or more');

const topic = options.topic === '' ? await topicFromStdin() : options.topic;

const debate = argue({
  topic: topic === '' ? undefined : topic,
  style: options.style,
  rounds: options.rounds,
  seed: options.seed,
  gary: options.gary,
  tolerance: options.tolerance,
});

if (options.json) {
  process.stdout.write(`${JSON.stringify(debate, null, 2)}\n`);
} else {
  const color = options.color && process.stdout.isTTY === true && !process.env.NO_COLOR;
  process.stdout.write(`${render(debate, { color, width: process.stdout.columns ?? 88 })}\n`);
}
