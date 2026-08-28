#!/usr/bin/env node
import { argue, MAX_ROUNDS, DEFAULT_TOPIC } from '../src/argubot.js';
import { render } from '../src/render.js';

const HELP = `argubot — a funny, aggressively nonbiased argument bot

Usage:
  argubot [topic...] [options]

Options:
  -r, --rounds <n>       arguments per side (1-${MAX_ROUNDS}, default 3)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
      --no-gary          hold the debate without Gary
      --json             print the debate as JSON
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version

Examples:
  argubot pineapple on pizza
  argubot "whether hot dogs are sandwiches" --rounds 5
  argubot standing desks --seed monday --json

The bot argues both sides from the same rhetorical moves, audits itself for
word-count bias, and refuses to reach a conclusion. Gary just says no.
`;

function parseArgs(argv) {
  const options = { rounds: 3, gary: true, json: false, color: true, tolerance: 2 };
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

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (options.version) {
  process.stdout.write('argubot 1.0.0\n');
  process.exit(0);
}

if (options.unknown) {
  process.stderr.write(`argubot: unknown option ${options.unknown}\nTry --help. Or argue about it.\n`);
  process.exit(2);
}

if (!Number.isFinite(options.rounds) || options.rounds < 1) {
  process.stderr.write('argubot: --rounds needs a positive number\n');
  process.exit(2);
}

if (!Number.isFinite(options.tolerance) || options.tolerance < 0) {
  process.stderr.write('argubot: --tolerance needs a number of zero or more\n');
  process.exit(2);
}

const debate = argue({
  topic: options.topic === '' ? DEFAULT_TOPIC : options.topic,
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
