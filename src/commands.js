// Read COMMANDS. Slash form, bare form, and dashed form are the same row.

import { STYLE_NAMES } from './styles.js';

export const COMMANDS = [
  { name: 'argue', also: ['/argue'], summary: 'one debate (default)' },
  { name: 'talk', also: ['/talk', 'i', '-i', '--talk'], summary: 'turn-taking conversation' },
  { name: 'burrito', also: ['/burrito', '/all', 'all', 'full', '/full', '--burrito', '--all'], summary: 'every style, full audit, one plate' },
  { name: 'help', also: ['/help', '/?', '?', '-h', '--help', '-?', '/'], summary: 'show help' },
  { name: 'version', also: ['/version', '-v', '--version'], summary: 'show version' },
  { name: 'lineage', also: ['/lineage', '--lineage'], summary: 'named catalog of borrowed ideas' },
  { name: 'styles', also: ['/styles', '--styles'], summary: 'list voices' },
  { name: 'commands', also: ['/commands', '--commands'], summary: 'list commands' },
  { name: 'validate', also: ['/validate', '--validate'], summary: 'run structural checks' },
  { name: 'ready', also: ['/ready', '--ready'], summary: 'tiny readiness line' },
  { name: 'menu', also: ['/menu', '--menu'], summary: 'numbered picker' },
];

const LOOKUP = new Map();
for (const command of COMMANDS) {
  LOOKUP.set(command.name, command.name);
  for (const alias of command.also) LOOKUP.set(alias, command.name);
}

const STYLE_FLAG = new Map([
  ['-p', 'plain'],
  ['--plain', 'plain'],
  ['--civic', 'civic'],
  ['--classic', 'classic'],
]);

const VALUE_FLAG = new Map([
  ['--style', 'style'],
  ['-r', 'rounds'],
  ['--rounds', 'rounds'],
  ['-s', 'seed'],
  ['--seed', 'seed'],
  ['-t', 'tolerance'],
  ['--tolerance', 'tolerance'],
  ['-w', 'width'],
  ['--width', 'width'],
  ['--name', 'dissentName'],
]);

export function resolveCommand(token) {
  if (token == null) return null;
  const key = String(token).trim();
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  if (key.startsWith('/') && LOOKUP.has(key.slice(1))) return LOOKUP.get(key.slice(1));
  return null;
}

export function formatCommandList() {
  return COMMANDS.map((command) => `  /${command.name.padEnd(10)} ${command.summary}`).join('\n');
}

export function parseSlash(raw) {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('/')) return null;
  const stripped = text.slice(1).trim();
  if (stripped === '') return { command: 'help', args: [], rest: '' };
  const [head, ...restParts] = stripped.split(/\s+/);
  const command = resolveCommand(head) ?? resolveCommand(`/${head}`) ?? head.toLowerCase();
  return { command, args: restParts, rest: restParts.join(' ') };
}

function applyCommand(options, name) {
  options.command = name;
  if (name === 'help') options.help = true;
  if (name === 'version') options.version = true;
}

function takeValue(argv, i) {
  return argv[i + 1];
}

export function parseArgs(argv) {
  const options = {
    command: 'argue',
    rounds: 3,
    dissent: false,
    dissentName: undefined,
    json: false,
    color: true,
    tolerance: 2,
    style: undefined,
    width: undefined,
    seed: undefined,
    topic: '',
    help: false,
    version: false,
  };
  const words = [];
  let i = 0;

  if (argv[0] && resolveCommand(argv[0])) {
    applyCommand(options, resolveCommand(argv[0]));
    i = 1;
  }

  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    const named = resolveCommand(arg);
    if (named && (arg.startsWith('/') || arg.startsWith('-')) && named !== 'argue') {
      applyCommand(options, named);
      continue;
    }

    if (STYLE_FLAG.has(arg)) {
      options.style = STYLE_FLAG.get(arg);
      continue;
    }

    if (VALUE_FLAG.has(arg)) {
      const field = VALUE_FLAG.get(arg);
      const value = takeValue(argv, i);
      i += 1;
      if (field === 'dissentName') {
        options.dissent = true;
        options.dissentName = value;
      } else if (field === 'rounds' || field === 'tolerance' || field === 'width') {
        options[field] = Number.parseInt(value, 10);
      } else {
        options[field] = value;
      }
      continue;
    }

    if (arg === '-d' || arg === '--dissent' || arg === '/dissent') {
      options.dissent = true;
      continue;
    }
    if (arg === '--no-dissent' || arg === '--no-gary') {
      options.dissent = false;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--no-color') {
      options.color = false;
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      options.unknown = arg;
    } else if (arg.startsWith('/') && arg.length > 1 && STYLE_NAMES.includes(arg.slice(1))) {
      options.style = arg.slice(1);
    } else {
      words.push(arg);
    }
  }

  options.topic = words.join(' ');
  if (options.style === undefined) options.style = 'classic';
  return options;
}
