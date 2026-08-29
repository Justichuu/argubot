// Every feature is a command and a flag. Slash form and dashed form both work.

import { STYLE_NAMES } from './styles.js';

export const COMMANDS = [
  { name: 'argue', aliases: ['/argue'], summary: 'one debate (default)' },
  { name: 'talk', aliases: ['/talk', 'i'], summary: 'turn-taking conversation' },
  { name: 'burrito', aliases: ['/burrito', '/all', 'all', 'full', '/full'], summary: 'every style, full audit, one plate' },
  { name: 'help', aliases: ['/help'], summary: 'show help' },
  { name: 'version', aliases: ['/version'], summary: 'show version' },
  { name: 'lineage', aliases: ['/lineage'], summary: 'named catalog of borrowed ideas' },
  { name: 'styles', aliases: ['/styles'], summary: 'list voices' },
  { name: 'commands', aliases: ['/commands'], summary: 'list commands' },
  { name: 'validate', aliases: ['/validate'], summary: 'run structural checks' },
  { name: 'ready', aliases: ['/ready'], summary: 'tiny readiness line' },
  { name: 'menu', aliases: ['/menu'], summary: 'numbered picker' },
];

const COMMAND_LOOKUP = new Map();
for (const command of COMMANDS) {
  COMMAND_LOOKUP.set(command.name, command.name);
  for (const alias of command.aliases) COMMAND_LOOKUP.set(alias, command.name);
}

export function resolveCommand(token) {
  if (token == null) return null;
  const key = String(token).trim();
  if (COMMAND_LOOKUP.has(key)) return COMMAND_LOOKUP.get(key);
  if (key.startsWith('/') && COMMAND_LOOKUP.has(key.slice(1))) return COMMAND_LOOKUP.get(key.slice(1));
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
    options.command = resolveCommand(argv[0]);
    i = 1;
  }

  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    const asCommand = resolveCommand(arg);
    if (asCommand && arg.startsWith('/') && asCommand !== 'argue') {
      if (asCommand === 'help') options.help = true;
      else if (asCommand === 'version') options.version = true;
      else options.command = asCommand;
      continue;
    }

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
      case '--classic':
        options.style = 'classic';
        break;
      case '-i':
      case '--talk':
        options.command = 'talk';
        break;
      case '--burrito':
      case '--all':
        options.command = 'burrito';
        break;
      case '--lineage':
        options.command = 'lineage';
        break;
      case '--styles':
        options.command = 'styles';
        break;
      case '--commands':
        options.command = 'commands';
        break;
      case '--validate':
        options.command = 'validate';
        break;
      case '--ready':
        options.command = 'ready';
        break;
      case '--menu':
        options.command = 'menu';
        break;
      case '--style':
        options.style = argv[i + 1];
        i += 1;
        break;
      case '-d':
      case '--dissent':
      case '/dissent':
        options.dissent = true;
        break;
      case '--no-dissent':
      case '--no-gary':
        options.dissent = false;
        break;
      case '--name':
        options.dissent = true;
        options.dissentName = argv[i + 1];
        i += 1;
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
      case '-w':
      case '--width':
        options.width = Number.parseInt(argv[i + 1], 10);
        i += 1;
        break;
      default:
        if (arg.startsWith('-') && arg.length > 1) {
          options.unknown = arg;
        } else if (arg.startsWith('/') && arg.length > 1 && STYLE_NAMES.includes(arg.slice(1))) {
          options.style = arg.slice(1);
        } else {
          words.push(arg);
        }
    }
  }

  options.topic = words.join(' ');
  if (options.style === undefined) options.style = 'classic';
  return options;
}
