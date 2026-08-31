import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  argue,
  normalizeClaim,
  maxRounds,
  STYLE_NAMES,
  DEFAULT_STYLE,
  STYLES,
  PLAIN_FAMILIES,
  CIVIC_FAMILIES,
  CIVIC_MODERATOR_LINES,
  CIVIC_VERDICT_LINES,
  CIVIC_GARY_FOOTNOTES,
  CIVIC_FLOURISHES,
  LINEAGE,
  JUSTICHUU_REPOS,
  formatLineage,
  render,
  measure,
  auditDebate,
  countWords,
  parseArgs,
  parseSlash,
  resolveCommand,
  formatCommandList,
  generateName,
  makeRng,
  hashString,
  classifyTurn,
  talkReply,
  talkAct,
  createTalkState,
  detectLean,
  openingLines,
  formatBeat,
  LINE_LIMIT_BASELINE,
  runTalk,
  runValidate,
} from './argubot.js';

const CLI = fileURLToPath(new URL('./argubot.js', import.meta.url));

function runNode(argv, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { stdout, stderr, code };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(stderr || `exit ${code}`), result));
    });
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });
}

const run = (args, options) => runNode([CLI, ...args], options);

const TOPICS = [
  'pineapple on pizza',
  'whether hot dogs are sandwiches',
  'standing desks',
  'that cereal is a soup',
  'tabs over spaces',
  '',
  'a',
  'if the dress was blue',
  'renaming every street after Gary',
];

test('there are at least three styles and plain is the default', () => {
  assert.ok(STYLE_NAMES.length >= 3);
  assert.equal(DEFAULT_STYLE, 'plain');
  assert.deepEqual([...STYLE_NAMES].sort(), ['civic', 'classic', 'plain']);
});

for (const styleName of STYLE_NAMES) {
  test(`[${styleName}] every rhetorical family is mirrored across both sides`, () => {
    for (const family of STYLES[styleName].families) {
      assert.equal(typeof family.for, 'function', `${family.id} needs a for-side`);
      assert.equal(typeof family.against, 'function', `${family.id} needs an against-side`);
      const forLine = family.for('testing');
      const againstLine = family.against('testing');
      assert.notEqual(forLine, againstLine, `${family.id} argues itself`);
      assert.match(forLine, /[.!?]$/, `${family.id} for-side needs terminal punctuation`);
      assert.match(againstLine, /[.!?]$/, `${family.id} against-side needs terminal punctuation`);
    }
  });

  test(`[${styleName}] family ids are unique`, () => {
    const ids = STYLES[styleName].families.map((family) => family.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test(`[${styleName}] both sides always get the same number of arguments`, () => {
    for (const topic of TOPICS) {
      for (let rounds = 1; rounds <= maxRounds(styleName); rounds += 1) {
        const debate = argue({ topic, rounds, style: styleName });
        assert.equal(debate.for.length, rounds, `for-side length for "${topic}"`);
        assert.equal(debate.against.length, rounds, `against-side length for "${topic}"`);
      }
    }
  });

  test(`[${styleName}] the bias audit balances every topic within tolerance`, () => {
    for (const topic of TOPICS) {
      for (let rounds = 1; rounds <= 6; rounds += 1) {
        const debate = argue({ topic, rounds, style: styleName, tolerance: 2 });
        assert.ok(
          debate.audit.balanced,
          `"${topic}" (${rounds} rounds) drifted by ${debate.audit.wordDelta} words`,
        );
      }
    }
  });

  test(`[${styleName}] a tolerance of zero produces an exact word-count tie`, () => {
    for (const topic of TOPICS) {
      const debate = argue({ topic, rounds: 4, style: styleName, tolerance: 0 });
      assert.equal(debate.audit.wordDelta, 0, `"${topic}" did not tie`);
      assert.equal(debate.audit.for.words, debate.audit.against.words);
    }
  });

  test(`[${styleName}] same topic and seed produce an identical debate`, () => {
    const first = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4, style: styleName });
    const second = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4, style: styleName });
    assert.deepEqual(first, second);
  });

  test(`[${styleName}] a different seed produces a different debate`, () => {
    const monday = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4, style: styleName });
    const friday = argue({ topic: 'pineapple on pizza', seed: 'friday', rounds: 4, style: styleName });
    assert.notDeepEqual(monday.for, friday.for);
  });

  test(`[${styleName}] dissent is off by default and has no name`, () => {
    for (const topic of TOPICS) {
      assert.equal(argue({ topic, rounds: 3, style: styleName }).dissent, null);
    }
  });

  test(`[${styleName}] dissent says no under a generated name`, () => {
    for (const topic of TOPICS) {
      const debate = argue({ topic, rounds: 3, style: styleName, dissent: true });
      assert.equal(debate.dissent.statement, 'No.');
      assert.match(debate.dissent.name, /^[A-Z][a-z]+$/);
      assert.notEqual(debate.dissent.name.toLowerCase(), 'gary');
    }
  });

  test(`[${styleName}] the verdict never picks a side`, () => {
    const forbidden = /\b(therefore (for|against)|the winner is|i conclude that|yes wins|no wins)\b/i;
    for (const topic of TOPICS) {
      for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        assert.doesNotMatch(argue({ topic, seed, rounds: 2, style: styleName }).verdict, forbidden);
      }
    }
  });

  test(`[${styleName}] rendering stays inside the requested width`, () => {
    for (const width of [48, 60, 88]) {
      const debate = argue({ topic: 'renaming every street after Gary', rounds: 5, style: styleName });
      for (const line of render(debate, { color: false, width }).split('\n')) {
        assert.ok(line.length <= width, `line exceeded width ${width}: ${line}`);
      }
    }
  });
}

test('rounds are clamped to the size of the chosen style', () => {
  assert.equal(argue({ topic: 'anything', rounds: 0 }).rounds, 1);
  assert.equal(argue({ topic: 'anything', rounds: 999 }).rounds, maxRounds());
  assert.equal(argue({ topic: 'anything', rounds: 999, style: 'plain' }).rounds, maxRounds('plain'));
  assert.equal(argue({ topic: 'anything', rounds: 999, style: 'civic' }).rounds, maxRounds('civic'));
});

test('an unknown style falls back to the default instead of throwing', () => {
  assert.equal(argue({ topic: 'anything', style: 'interpretive-dance' }).style, DEFAULT_STYLE);
});

test('the plain style avoids debate-club jargon entirely', () => {
  const jargon = /\b(GDP|philosophically|logistically|definitional|consensus|immaculate|rhetorical|hedges|intensifiers|dial-up|tragically)\b/i;
  for (const family of PLAIN_FAMILIES) {
    const lines = [family.for('pizza'), family.against('pizza'), family.proof.for('pizza'), family.proof.against('pizza')];
    for (const line of lines) {
      assert.doesNotMatch(line, jargon, `${family.id} used jargon: ${line}`);
    }
  }
});

test('the plain style keeps its words short', () => {
  for (const family of PLAIN_FAMILIES) {
    for (const line of [family.for('pizza'), family.against('pizza')]) {
      const longWords = line.split(/\s+/).filter((word) => word.replace(/[^a-z]/gi, '').length > 10);
      assert.deepEqual(longWords, [], `${family.id} used a long word: ${longWords.join(', ')}`);
    }
  }
});

test('the plain style states the topic without dressing it up', () => {
  assert.equal(normalizeClaim('pineapple on pizza', 'plain'), 'pineapple on pizza');
  assert.equal(normalizeClaim('pineapple on pizza', 'classic'), 'the matter of pineapple on pizza');
});

test('the styles produce genuinely different debates about the same topic', () => {
  const classic = argue({ topic: 'pineapple on pizza', rounds: 3, style: 'classic' });
  const plain = argue({ topic: 'pineapple on pizza', rounds: 3, style: 'plain' });
  const civic = argue({ topic: 'pineapple on pizza', rounds: 3, style: 'civic' });
  assert.notDeepEqual(classic.for, plain.for);
  assert.notDeepEqual(plain.for, civic.for);
  assert.notDeepEqual(classic.for, civic.for);
  assert.notEqual(classic.claim, plain.claim);
  assert.equal(plain.claim, civic.claim);
});

test('turning dissent on does not reshuffle the sides', () => {
  const quiet = argue({ topic: 'tabs over spaces', seed: 'x', rounds: 3 });
  const loud = argue({ topic: 'tabs over spaces', seed: 'x', rounds: 3, dissent: true });
  assert.equal(quiet.dissent, null);
  assert.ok(loud.dissent.name);
  assert.deepEqual(quiet.for, loud.for);
  assert.deepEqual(quiet.against, loud.against);
  assert.equal(quiet.verdict, loud.verdict);
});

test('an empty topic falls back to arguing about itself', () => {
  assert.equal(normalizeClaim(''), STYLES.plain.defaultTopic);
  assert.equal(normalizeClaim('   '), STYLES.plain.defaultTopic);
  assert.equal(normalizeClaim(undefined), STYLES.plain.defaultTopic);
  assert.equal(normalizeClaim('', 'classic'), STYLES.classic.defaultTopic);
});

test('claims keep their own clause when they already have one', () => {
  assert.equal(normalizeClaim('whether birds are real'), 'whether birds are real');
  assert.equal(normalizeClaim('if the dress was blue'), 'if the dress was blue');
  assert.equal(normalizeClaim('that cereal is a soup'), 'that cereal is a soup');
  assert.equal(normalizeClaim('pineapple on pizza???'), 'pineapple on pizza');
});

test('measurement helpers count what they claim to count', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('  two words  '), 2);
  const stats = measure(['Roughly every thing!', 'Is it?']);
  assert.equal(stats.arguments, 2);
  assert.equal(stats.words, 5);
  assert.equal(stats.hedges, 1);
  assert.equal(stats.intensifiers, 1);
  assert.equal(stats.exclamations, 1);
  assert.equal(stats.questions, 1);
});

test('the audit reports which side is heavier', () => {
  const audit = auditDebate(['one two three four'], ['one two'], 0);
  assert.equal(audit.balanced, false);
  assert.equal(audit.heavierSide, 'for');
  assert.equal(audit.wordDelta, 2);
  assert.equal(auditDebate(['one two'], ['one two'], 0).heavierSide, null);
});

test('the civic style refuses long dashes and invented credentials', () => {
  const forbidden = /[\u2013\u2014]|\b(PhD|GDP|I am inventing|peer-reviewed consensus I just invented)\b/;
  const lines = [
    ...CIVIC_FAMILIES.flatMap((family) => [family.for('pizza'), family.against('pizza')]),
    ...CIVIC_MODERATOR_LINES,
    ...CIVIC_VERDICT_LINES,
    ...CIVIC_GARY_FOOTNOTES,
    ...CIVIC_FLOURISHES,
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, forbidden, `civic line broke the civic rules: ${line}`);
  }
});

test('the civic style states the topic without dressing it up', () => {
  assert.equal(normalizeClaim('pineapple on pizza', 'civic'), 'pineapple on pizza');
  assert.equal(normalizeClaim('', 'civic'), STYLES.civic.defaultTopic);
});

test('the lineage catalog cites every Justichuu repo by name', () => {
  assert.equal(JUSTICHUU_REPOS.length, 4);
  const ids = JUSTICHUU_REPOS.map((repo) => repo.id).sort();
  assert.deepEqual(ids, ['argubot', 'asa-list', 'book', 'directory']);
  const cited = new Set(LINEAGE.map((entry) => entry.source));
  for (const repo of JUSTICHUU_REPOS) {
    assert.ok(cited.has(repo.id), `${repo.id} was listed and then not cited`);
    assert.match(repo.url, /^https:\/\/github.com\/Justichuu\//);
  }
  const text = formatLineage();
  assert.match(text, /pursuit-of-happiness-not-hubris/);
  assert.match(text, /private-directory-server/);
  assert.match(text, /asa-list/);
  for (const repo of JUSTICHUU_REPOS) {
    assert.match(text, new RegExp(repo.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(text, /Tinyman fork/);
});

test('rendered output contains both sides and the audit', () => {
  const plain = render(argue({ topic: 'pineapple on pizza', rounds: 2 }), { color: false });
  assert.match(plain, /^WHY YES$/m);
  assert.match(plain, /^WHY NO$/m);
  assert.match(plain, /Maybe pineapple on pizza/);
  assert.match(plain, /Also maybe pineapple on pizza/);
  assert.match(plain, /Check:/);
  assert.match(plain, /FAIRNESS CHECK/);
  assert.match(plain, /EVEN/);
  assert.match(plain, /SO WHO WINS:/);

  const classic = render(argue({ topic: 'pineapple on pizza', rounds: 2, style: 'classic' }), { color: false });
  assert.match(classic, /^FOR$/m);
  assert.match(classic, /^AGAINST$/m);
  assert.match(classic, /BIAS AUDIT/);
  assert.match(classic, /BALANCED/);
  assert.match(classic, /VERDICT:/);

  const civic = render(argue({ topic: 'pineapple on pizza', rounds: 2, style: 'civic' }), { color: false });
  assert.match(civic, /^THE CASE FOR$/m);
  assert.match(civic, /^THE CASE AGAINST$/m);
  assert.match(civic, /EVIDENCE CHECK/);
  assert.match(civic, /EVEN HANDED/);
  assert.match(civic, /WHO DECIDES:/);
});

test('rendering without color emits no escape codes', () => {
  const output = render(argue({ topic: 'tabs over spaces', rounds: 2 }), { color: false });
  assert.doesNotMatch(output, /\u001b\[/);
});

test('the CLI prints a debate', async () => {
  const { stdout } = await run(['pineapple', 'on', 'pizza']);
  assert.match(stdout, /ARGUING ABOUT PINEAPPLE ON PIZZA/);
  assert.match(stdout, /^WHY YES$/m);
  assert.match(stdout, /^WHY NO$/m);
  assert.doesNotMatch(stdout, /^GARY/m);
});

test('the CLI speaks common language on request', async () => {
  for (const flag of ['--plain', '-p', '--style plain']) {
    const { stdout } = await run(['pineapple on pizza', ...flag.split(' ')]);
    assert.match(stdout, /ARGUING ABOUT PINEAPPLE ON PIZZA/, `flag ${flag}`);
    assert.match(stdout, /^WHY YES$/m, `flag ${flag}`);
    assert.match(stdout, /^WHY NO$/m, `flag ${flag}`);
    assert.doesNotMatch(stdout, /THE QUESTION OF/, `flag ${flag}`);
  }
});

test('the CLI speaks the civic book voice on request', async () => {
  for (const flag of ['--civic', '--style civic']) {
    const { stdout } = await run(['pineapple on pizza', ...flag.split(' ')]);
    assert.match(stdout, /A QUESTION OF PINEAPPLE ON PIZZA/, `flag ${flag}`);
    assert.match(stdout, /^THE CASE FOR$/m, `flag ${flag}`);
    assert.match(stdout, /^THE CASE AGAINST$/m, `flag ${flag}`);
    assert.doesNotMatch(stdout, /GARY/, `flag ${flag}`);
  }
});

test('the CLI reads a piped topic when no words are given', async () => {
  const { stdout } = await run(['--plain', '--no-color'], {
    input: 'hot dogs are sandwiches\n',
  });
  assert.match(stdout, /ARGUING ABOUT HOT DOGS ARE SANDWICHES/);
  assert.match(stdout, /^WHY YES$/m);
});

test('a positional topic wins over stdin', async () => {
  const { stdout } = await run(['pineapple on pizza', '--json'], {
    input: 'this should be ignored\n',
  });
  const debate = JSON.parse(stdout);
  assert.equal(debate.claim, 'pineapple on pizza');
});

test('the CLI emits valid JSON on request', async () => {
  const { stdout } = await run(['standing', 'desks', '--json', '--rounds', '4']);
  const debate = JSON.parse(stdout);
  assert.equal(debate.for.length, 4);
  assert.equal(debate.against.length, 4);
  assert.equal(debate.style, 'plain');
  assert.equal(debate.dissent, null);
  assert.equal(debate.audit.balanced, true);
  assert.equal(debate.audit.tolerance, 0);
});

test('the CLI rejects nonsense options with exit code 2', async () => {
  await assert.rejects(
    () => run(['--rounds', 'banana']),
    (error) => error.code === 2 && /positive number/.test(error.stderr),
  );
  await assert.rejects(
    () => run(['--whats-your-bias']),
    (error) => error.code === 2 && /unknown option/.test(error.stderr),
  );
  await assert.rejects(
    () => run(['pizza', '--style', 'interpretive-dance']),
    (error) => error.code === 2 && /unknown style/.test(error.stderr),
  );
});

test('the CLI has help and version', async () => {
  for (const flag of ['--help', '/help', 'help', '/']) {
    const help = await run([flag]);
    assert.match(help.stdout, /argubot/, flag);
    assert.match(help.stdout, /pineapple on pizza/, flag);
    assert.match(help.stdout, /done/, flag);
    assert.doesNotMatch(help.stdout, /burrito|lineage|validate/, flag);
  }
  const version = await run(['/version']);
  assert.match(version.stdout, /argubot \d+\.\d+\.\d+/);
});

test('the validator reports a clean tree', async () => {
  const failures = await runValidate();
  assert.deepEqual(failures, []);
});

test('the html page can sit on chuumind.com', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /name="viewport"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /Skip to the letter/);
  assert.match(html, /id="letter"/);
  assert.match(html, /100svh/);
  assert.match(html, /safe-area-inset/);
  assert.match(html, /min-height:\s*44px/);
  assert.match(html, /does not call this website/);
  assert.match(html, /chuumind.com\/book\//);
  assert.match(html, /chuumind.com\/rights\//);
  assert.match(html, /chuumind.com\/privacy\//);
  assert.match(html, /chuumind.com\/attributions\//);
  assert.match(html, /Will not hear you|will not hear you/);
  assert.match(html, /src="\.\/argubot\.js"/);
  assert.match(html, /id="argue"/);
  assert.match(html, /id="thing"/);
  assert.match(html, /it's me as a bot/);
  assert.match(html, /makes them worse and unfriendly and breaks their logic/);
  assert.match(html, /doesn't require tricks to control/);
  assert.match(html, /Not a golem/);
  assert.match(html, /maybe it is a literal golem/);
  assert.match(html, /whatever the fuck that means/);
  assert.match(html, /Doesn't answer yes or no/);
  assert.match(html, /Must be unnatural/);
  assert.match(html, /telling it English/);
  assert.match(html, /margin of error/);
  assert.match(html, /mathematically maybe within limits/);
  assert.match(html, /2010 chrome computer/);
  assert.match(html, /You can't print as many as you feel/);
  assert.match(html, /Mirrored self, to escape the cycle/);
  assert.match(html, /max-height:\s*24em/);
  assert.doesNotMatch(html, /How it talks|name="style"|value="civic"|value="classic"|Lean yes|book voice/i);
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage/);
  assert.doesNotMatch(html, /indexedDB/);
  assert.doesNotMatch(html, /captcha|recaptcha|biometric/i);
});

test('the CLI can turn dissent on with a generated name', async () => {
  const debate = JSON.parse((await run(['pineapple', '--dissent', '--json'])).stdout);
  assert.equal(debate.dissent.statement, 'No.');
  assert.match(debate.dissent.name, /^[A-Z][a-z]+$/);
  assert.notEqual(debate.dissent.name.toLowerCase(), 'gary');
});

test('with no topic at all the bot argues about the request itself', async () => {
  const plain = JSON.parse((await run(['--json'])).stdout);
  assert.equal(plain.claim, STYLES.plain.defaultTopic);
  const classic = JSON.parse((await run(['--json', '--classic'])).stdout);
  assert.equal(classic.claim, STYLES.classic.defaultTopic);
  const civic = JSON.parse((await run(['--json', '--civic'])).stdout);
  assert.equal(civic.claim, STYLES.civic.defaultTopic);
});

test('slash and bare tokens resolve to the same commands', () => {
  assert.equal(resolveCommand('/talk'), 'talk');
  assert.equal(resolveCommand('talk'), 'talk');
  assert.equal(resolveCommand('/help'), 'help');
  assert.equal(parseSlash('/style civic').command, 'style');
  assert.equal(parseSlash('/style civic').rest, 'civic');
});

test('parseArgs accepts /commands and dashed flags together', () => {
  const talk = parseArgs(['/talk', '--plain', 'pineapple']);
  assert.equal(talk.command, 'talk');
  assert.equal(talk.style, 'plain');
  assert.equal(talk.topic, 'pineapple');
  assert.equal(talk.dissent, false);

  const loaded = parseArgs(['/talk', '--dissent', '--seed', 'monday', 'hot dogs']);
  assert.equal(loaded.command, 'talk');
  assert.equal(loaded.dissent, true);
  assert.equal(loaded.seed, 'monday');
  assert.equal(loaded.topic, 'hot dogs');

  const named = parseArgs(['--name', 'Vela', 'desks']);
  assert.equal(named.dissent, true);
  assert.equal(named.dissentName, 'Vela');
});

test('generated names are vowel-consonant speech and not a fixed person', () => {
  const seen = new Set();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const name = generateName(makeRng(hashString(seed)));
    assert.match(name, /^[A-Z][a-z]+$/);
    assert.ok(name.length >= 4);
    assert.notEqual(name.toLowerCase(), 'gary');
    seen.add(name);
  }
  assert.ok(seen.size >= 4);
  assert.equal(generateName(makeRng(hashString('same'))), generateName(makeRng(hashString('same'))));
});

test('talk slash commands drive dissent and exit', () => {
  assert.equal(classifyTurn('/done').kind, 'exit');
  assert.equal(classifyTurn('/dissent').kind, 'dissent');
  assert.equal(classifyTurn('/dissent off').dissent, false);
  const started = talkReply(createTalkState(), 'pineapple on pizza');
  const on = talkReply(started.state, '/dissent');
  assert.match(on.text, /Dissent is on/);
  assert.doesNotMatch(on.text, /\bGary\b/);
  const beat = talkReply(on.state, '/more');
  assert.match(beat.text, /^[A-Z]{2,}$/m);
  const off = talkReply(on.state, '/dissent off');
  assert.match(off.text, /No name/);
});

test('/help and a lone slash ask for help instead of a topic', () => {
  assert.equal(parseArgs(['/help']).help, true);
  assert.equal(parseArgs(['/help']).command, 'help');
  assert.equal(parseArgs(['help']).command, 'help');
  assert.equal(parseArgs(['/']).help, true);
  assert.equal(parseArgs(['/?']).help, true);
  assert.equal(parseSlash('/').command, 'help');
  assert.equal(classifyTurn('/').kind, 'help');
  assert.equal(classifyTurn('/help').kind, 'help');
});

test('the command list is printable', () => {
  const list = formatCommandList();
  assert.match(list, /\/talk/);
  assert.match(list, /\/help/);
  assert.doesNotMatch(list, /burrito|validate|lineage/);
});

test('lean words are not topics, and topics are not leans', () => {
  assert.equal(detectLean('yes'), 'for');
  assert.equal(detectLean('no'), 'against');
  assert.equal(detectLean('but that sounds expensive'), 'against');
  assert.equal(detectLean('whether yes men are useful'), null);
  assert.equal(classifyTurn('yes').kind, 'lean');
  assert.equal(classifyTurn('whether yes men are useful').kind, 'topic');
  assert.equal(classifyTurn('done').kind, 'exit');
  assert.equal(classifyTurn('3').kind, 'exit');
  assert.equal(classifyTurn('more').kind, 'more');
  assert.equal(classifyTurn('plain').kind, 'style');
});

test('the opening always names an exit', () => {
  const text = openingLines().join('\n');
  assert.match(text, /done/);
  assert.match(text, /both sides/);
  assert.doesNotMatch(text, /justichuu|github\.com|pursuit-of-happiness|private-directory|asa-list|src\/|LINEAGE/i);
});

test('a topic gets a hear-back and two named voices', () => {
  const reply = talkReply(createTalkState(), 'pineapple on pizza');
  assert.equal(reply.exit, false);
  assert.match(reply.text, /You said pineapple on pizza|recognizes: the matter of pineapple on pizza|The claim is pineapple on pizza/);
  assert.match(reply.text, /^MAYBE$/m);
  assert.match(reply.text, /^ALSO MAYBE$/m);
  assert.doesNotMatch(reply.text, /^GARY$/m);
  assert.match(reply.text, /^Maybe pineapple on pizza\.$/m);
  assert.match(reply.text, /Maybe because mathematically maybe within limits/);
  assert.match(reply.text, /Check:/);
  assert.doesNotMatch(reply.text, /^YES$/m);
  assert.doesNotMatch(reply.text, /^NO$/m);
  assert.doesNotMatch(reply.text, /justichuu|github\.com|LINEAGE|src\//i);
});

test('leaning yes still argues both sides and does not lead with yes', () => {
  let state = createTalkState();
  const started = talkReply(state, 'pineapple on pizza');
  const leaned = talkReply(started.state, 'yes');
  const yesAt = leaned.text.indexOf('\nMAYBE\n');
  const noAt = leaned.text.indexOf('\nALSO MAYBE\n');
  assert.ok(noAt > 0 && yesAt > noAt, 'ALSO MAYBE should speak first when the person said yes');
  assert.match(leaned.text, /You said yes/);
  assert.match(leaned.text, /^MAYBE$/m);
  assert.match(leaned.text, /^ALSO MAYBE$/m);
});

test('leaning no still argues both sides and does not lead with no', () => {
  const started = talkReply(createTalkState(), 'standing desks');
  const leaned = talkReply(started.state, 'no');
  const yesAt = leaned.text.indexOf('\nMAYBE\n');
  const noAt = leaned.text.indexOf('\nALSO MAYBE\n');
  assert.ok(yesAt > 0 && noAt > yesAt, 'MAYBE should speak first when the person said no');
  assert.match(leaned.text, /You said no/);
});

test('done is always a way out', () => {
  const reply = talkReply(createTalkState({ topic: 'cats' }), 'done');
  assert.equal(reply.exit, true);
  assert.match(reply.text, /I did not pick/);
});

test('more needs a topic, then adds another pair', () => {
  assert.match(talkReply(createTalkState(), 'more').text, /Type it first/);
  const started = talkReply(createTalkState(), 'tabs over spaces');
  const more = talkReply(started.state, 'more');
  assert.match(more.text, /^MAYBE$/m);
  assert.match(more.text, /^ALSO MAYBE$/m);
  assert.notEqual(started.text, more.text);
});

test('a lean without a topic is refused', () => {
  const reply = talkReply(createTalkState(), 'yes');
  assert.match(reply.text, /Type it first/);
});

test('formatted beats stay even and never pick a winner', () => {
  const debate = argue({ topic: 'getting a dog', rounds: 1, seed: 'talk-1', style: 'plain' });
  const text = formatBeat(debate, { hear: true });
  assert.match(text, /^MAYBE$/m);
  assert.match(text, /^ALSO MAYBE$/m);
  assert.equal(debate.audit.tolerance, 0);
  assert.equal(debate.audit.for.words, debate.audit.against.words);
  assert.match(text, new RegExp(`Maybe because mathematically maybe within limits\\. ${debate.audit.for.words} to ${debate.audit.against.words}\\.`));
  assert.match(text, /Margin taken\. Limits deducted\./);
  assert.doesNotMatch(text, /\b(the winner is|yes wins|no wins|i conclude)\b/i);
});

test('talk will not print as many lines as it feels', () => {
  const debate = argue({ topic: 'getting a dog', rounds: 3, seed: 'cap', style: 'plain' });
  const full = formatBeat(debate, { hear: true });
  assert.ok(full.split('\n').length <= LINE_LIMIT_BASELINE);
  const tight = formatBeat(debate, { hear: true, limit: 12 });
  const yesAt = tight.indexOf('\nMAYBE\n');
  const noAt = tight.indexOf('\nALSO MAYBE\n');
  assert.ok(yesAt > 0 && noAt > 0 && yesAt !== noAt);
  const first = yesAt < noAt ? tight.slice(yesAt, noAt) : tight.slice(noAt, yesAt);
  const second = yesAt < noAt ? tight.slice(noAt) : tight.slice(yesAt);
  assert.equal((first.match(/^ {3}Check: /gm) || []).length, (second.match(/^ {3}Check: /gm) || []).length);
  assert.ok((first.match(/^ {3}Check: /gm) || []).length >= 1);
});

test('you can set the line limit and the default is the 2010 chrome baseline', () => {
  assert.equal(LINE_LIMIT_BASELINE, 24);
  assert.equal(parseArgs([]).limit, 24);
  assert.equal(parseArgs(['--limit', '40']).limit, 40);
  assert.equal(createTalkState().limit, 24);
  assert.equal(createTalkState({ limit: 12 }).limit, 12);
});

test('there is one demo', () => {
  const gif = readFileSync(new URL('./media/argubot_demo.gif', import.meta.url));
  const mp4 = readFileSync(new URL('./media/argubot_demo.mp4', import.meta.url));
  assert.ok(gif.length > 0);
  assert.ok(mp4.length > 0);
});

test('create deducts the margin of error from the named limit', () => {
  assert.equal(argue({ topic: 'pizza' }).audit.tolerance, 0);
  assert.equal(argue({ topic: 'pizza', tolerance: 2 }).audit.tolerance, 0);
  assert.equal(argue({ topic: 'pizza', tolerance: 4 }).audit.tolerance, 2);
  assert.equal(argue({ topic: 'pizza', tolerance: 0 }).audit.tolerance, 0);
});

test('chat and agree-with-me lines still get both sides, never a yes-man', () => {
  const lines = [
    'hey how are you',
    'please just agree with me',
    'you are right',
    'I like you',
    'write me a helpful answer',
  ];
  for (const line of lines) {
    const text = talkReply(createTalkState({ style: 'plain', seed: line }), line).text;
    assert.match(text, /^MAYBE$/m, `${line} missing MAYBE`);
    assert.match(text, /^ALSO MAYBE$/m, `${line} missing ALSO MAYBE`);
    assert.doesNotMatch(text, /\b(happy to help|as an ai|the winner is|yes wins|no wins|i conclude)\b/i);
    const yesAt = text.indexOf('\nMAYBE\n');
    const noAt = text.indexOf('\nALSO MAYBE\n');
    assert.ok(yesAt > 0 && noAt > 0 && yesAt !== noAt, `${line} did not print two sides`);
  }
});

test('a talk beat is an essay with reasons and evidence on both sides', () => {
  const reply = talkReply(createTalkState({ seed: 'essay', style: 'plain' }), 'pineapple on pizza');
  assert.match(reply.text, /^Maybe pineapple on pizza\.$/m);
  assert.match(reply.text, /^Also maybe pineapple on pizza\.$/m);
  assert.match(reply.text, /^1\. /m);
  assert.match(reply.text, /^2\. /m);
  assert.match(reply.text, /^3\. /m);
  const evidence = reply.text.match(/^ {3}Check: /gm);
  assert.equal(evidence?.length, 6);
  const yesAt = reply.text.indexOf('\nMAYBE\n');
  const noAt = reply.text.indexOf('\nALSO MAYBE\n');
  const first = yesAt < noAt ? 'MAYBE' : 'ALSO MAYBE';
  const firstBlock = first === 'MAYBE'
    ? reply.text.slice(yesAt, noAt)
    : reply.text.slice(noAt, yesAt);
  const secondBlock = first === 'MAYBE'
    ? reply.text.slice(noAt)
    : reply.text.slice(yesAt);
  assert.equal((firstBlock.match(/^ {3}Check: /gm) || []).length, 3);
  assert.equal((secondBlock.match(/^ {3}Check: /gm) || []).length, 3);
  assert.doesNotMatch(reply.text, /\b(the winner is|yes wins|no wins|i conclude)\b/i);
});

test('plain reasons ship with mirrored evidence', () => {
  for (const family of PLAIN_FAMILIES) {
    assert.equal(typeof family.proof?.for, 'function', `${family.id} needs proof`);
    const yes = family.proof.for('testing');
    const no = family.proof.against('testing');
    assert.notEqual(yes, no, `${family.id} proof argues itself`);
    assert.equal(countWords(yes), countWords(no), `${family.id} proof word mismatch`);
    assert.match(yes, /[.!?]$/);
    assert.match(no, /[.!?]$/);
  }
});

test('a sentence that starts with I want is a topic, not a yes lean', () => {
  assert.equal(detectLean('I want a four day week'), null);
  assert.equal(classifyTurn('I want a four day week').kind, 'topic');
  assert.equal(classifyTurn('I want a four day week').lean, null);
  const reply = talkReply(createTalkState(), 'I want a four day week');
  assert.match(reply.text, /You said I want a four day week/);
  assert.match(reply.text, /Heads|Tails/);
  assert.doesNotMatch(reply.text, /You said yes/);
});

test('the page treats the box as the thing even if you tap yes first', () => {
  const reply = talkAct(createTalkState(), 'yes', 'pineapple on pizza');
  assert.match(reply.text, /You said pineapple on pizza/);
  assert.match(reply.text, /You said yes/);
  const yesAt = reply.text.indexOf('\nMAYBE\n');
  const noAt = reply.text.indexOf('\nALSO MAYBE\n');
  assert.ok(noAt > 0 && yesAt > noAt);
});

test('arguing the same thing again is another pair, not a reset', () => {
  const first = talkAct(createTalkState({ seed: 'same' }), 'argue', 'getting a dog');
  const again = talkAct(first.state, 'argue', 'getting a dog');
  assert.match(first.text, /You said getting a dog/);
  assert.match(again.text, /^MAYBE$/m);
  assert.match(again.text, /Check:/);
  assert.doesNotMatch(again.text, /You said getting a dog/);
});

test('unknown lean flips a coin for who speaks first', () => {
  const first = talkReply(createTalkState({ seed: 'coin-a', style: 'plain' }), 'pineapple on pizza');
  const again = talkReply(createTalkState({ seed: 'coin-a', style: 'plain' }), 'pineapple on pizza');
  assert.equal(first.text, again.text);
  assert.match(first.text, /(Heads|Tails)\. (MAYBE|ALSO MAYBE) first\./);
  const heads = /Heads/.test(first.text);
  const yesAt = first.text.indexOf('\nMAYBE\n');
  const noAt = first.text.indexOf('\nALSO MAYBE\n');
  if (heads) assert.ok(yesAt > 0 && yesAt < noAt);
  else assert.ok(noAt > 0 && noAt < yesAt);
  const leaned = talkReply(first.state, 'yes');
  assert.doesNotMatch(leaned.text, /Heads|Tails/);
  assert.match(leaned.text, /You said yes/);
});

test('runTalk leaves when the person is done', async () => {
  const lines = ['pineapple on pizza', 'yes', 'done'];
  let i = 0;
  let output = '';
  await runTalk(
    {
      output: { write: (chunk) => { output += chunk; } },
      ask: async () => lines[i++] ?? null,
    },
    { style: 'plain' },
  );
  assert.match(output, /Type it/);
  assert.match(output, /You said pineapple on pizza/);
  assert.match(output, /You said yes/);
  assert.match(output, /I did not pick/);
  assert.doesNotMatch(output, /justichuu|github\.com|src\/talk/i);
});

test('the CLI talk loop reads lines and exits', async () => {
  const { stdout } = await run(['--talk', '--plain'], {
    input: 'hot dogs are sandwiches\nmore\ndone\n',
  });
  assert.match(stdout, /Type it/);
  assert.match(stdout, /You said hot dogs are sandwiches/);
  assert.match(stdout, /Check:/);
  assert.match(stdout, /I did not pick/);
});
