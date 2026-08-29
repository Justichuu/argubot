import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { argue, normalizeClaim, maxRounds, STYLE_NAMES, DEFAULT_STYLE } from '../src/argubot.js';
import { measure, auditDebate, countWords } from '../src/audit.js';
import { STYLES } from '../src/styles.js';
import { PLAIN_FAMILIES } from '../src/plain.js';
import {
  CIVIC_FAMILIES,
  CIVIC_MODERATOR_LINES,
  CIVIC_VERDICT_LINES,
  CIVIC_GARY_FOOTNOTES,
  CIVIC_FLOURISHES,
} from '../src/civic.js';
import { LINEAGE, JUSTICHUU_REPOS, formatLineage } from '../src/lineage.js';
import { render } from '../src/render.js';

const CLI = fileURLToPath(new URL('../bin/argubot.js', import.meta.url));

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

test('there are at least three styles and classic is the default', () => {
  assert.ok(STYLE_NAMES.length >= 3);
  assert.equal(DEFAULT_STYLE, 'classic');
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

  test(`[${styleName}] Gary says no, and only no`, () => {
    for (const topic of TOPICS) {
      assert.equal(argue({ topic, rounds: 3, style: styleName }).gary.statement, 'No.');
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
  assert.equal(argue({ topic: 'anything', rounds: 999 }).rounds, maxRounds('classic'));
  assert.equal(argue({ topic: 'anything', rounds: 999, style: 'plain' }).rounds, maxRounds('plain'));
  assert.equal(argue({ topic: 'anything', rounds: 999, style: 'civic' }).rounds, maxRounds('civic'));
});

test('an unknown style falls back to the default instead of throwing', () => {
  assert.equal(argue({ topic: 'anything', style: 'interpretive-dance' }).style, DEFAULT_STYLE);
});

test('the plain style avoids debate-club jargon entirely', () => {
  const jargon = /\b(GDP|philosophically|logistically|definitional|consensus|immaculate|rhetorical|hedges|intensifiers|dial-up|tragically)\b/i;
  for (const family of PLAIN_FAMILIES) {
    assert.doesNotMatch(family.for('pizza'), jargon, `${family.id} for-side used jargon`);
    assert.doesNotMatch(family.against('pizza'), jargon, `${family.id} against-side used jargon`);
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

test('Gary can be excluded without disturbing the debate', () => {
  const withGary = argue({ topic: 'tabs over spaces', seed: 'x', rounds: 3 });
  const without = argue({ topic: 'tabs over spaces', seed: 'x', rounds: 3, gary: false });
  assert.equal(without.gary, null);
  assert.deepEqual(without.for, withGary.for);
  assert.deepEqual(without.against, withGary.against);
  assert.equal(without.verdict, withGary.verdict);
});

test('an empty topic falls back to arguing about itself', () => {
  assert.equal(normalizeClaim(''), STYLES.classic.defaultTopic);
  assert.equal(normalizeClaim('   '), STYLES.classic.defaultTopic);
  assert.equal(normalizeClaim(undefined), STYLES.classic.defaultTopic);
  assert.equal(normalizeClaim('', 'plain'), STYLES.plain.defaultTopic);
});

test('claims keep their own clause when they already have one', () => {
  assert.equal(normalizeClaim('whether birds are real'), 'whether birds are real');
  assert.equal(normalizeClaim('if the dress was blue'), 'if the dress was blue');
  assert.equal(normalizeClaim('that cereal is a soup'), 'that cereal is a soup');
  assert.equal(normalizeClaim('pineapple on pizza???'), 'the matter of pineapple on pizza');
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
  const markdown = readFileSync(new URL('../LINEAGE.md', import.meta.url), 'utf8');
  for (const repo of JUSTICHUU_REPOS) {
    assert.match(markdown, new RegExp(repo.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(markdown, /Tinyman fork/);
});

test('rendered output contains both sides and the audit', () => {
  const classic = render(argue({ topic: 'pineapple on pizza', rounds: 2 }), { color: false });
  assert.match(classic, /^FOR$/m);
  assert.match(classic, /^AGAINST$/m);
  assert.match(classic, /BIAS AUDIT/);
  assert.match(classic, /BALANCED/);
  assert.match(classic, /VERDICT:/);

  const plain = render(argue({ topic: 'pineapple on pizza', rounds: 2, style: 'plain' }), { color: false });
  assert.match(plain, /^WHY YES$/m);
  assert.match(plain, /^WHY NO$/m);
  assert.match(plain, /FAIRNESS CHECK/);
  assert.match(plain, /EVEN/);
  assert.match(plain, /SO WHO WINS:/);

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
  assert.match(stdout, /THE QUESTION OF THE MATTER OF PINEAPPLE ON PIZZA/);
  assert.match(stdout, /^FOR$/m);
  assert.match(stdout, /^AGAINST$/m);
  assert.match(stdout, /^GARY \(independent\)$/m);
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
    assert.match(stdout, /GARY \(not a recipe\)/, `flag ${flag}`);
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
  assert.equal(debate.claim, 'the matter of pineapple on pizza');
});

test('the CLI prints the lineage catalog', async () => {
  const { stdout } = await run(['--lineage']);
  assert.match(stdout, /argubot lineage/);
  assert.match(stdout, /Justichuu\/pursuit-of-happiness-not-hubris/);
  assert.match(stdout, /Justichuu\/private-directory-server/);
  assert.match(stdout, /Justichuu\/asa-list/);
  assert.match(stdout, /mirrored-pairs/);
});

test('the CLI emits valid JSON on request', async () => {
  const { stdout } = await run(['standing', 'desks', '--json', '--rounds', '4']);
  const debate = JSON.parse(stdout);
  assert.equal(debate.for.length, 4);
  assert.equal(debate.against.length, 4);
  assert.equal(debate.style, 'classic');
  assert.equal(debate.gary.statement, 'No.');
  assert.equal(debate.audit.balanced, true);
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
  const help = await run(['--help']);
  assert.match(help.stdout, /nonbiased argument bot/);
  assert.match(help.stdout, /common language/);
  assert.match(help.stdout, /book voice/);
  assert.match(help.stdout, /--lineage/);
  assert.match(help.stdout, /--talk/);
  const version = await run(['--version']);
  assert.match(version.stdout, /argubot \d+\.\d+\.\d+/);
});

test('the validator reports a clean tree', async () => {
  const script = fileURLToPath(new URL('../scripts/validate.js', import.meta.url));
  const { stdout } = await runNode([script]);
  assert.match(stdout, /argubot validation passed/);
});

test('with no topic at all the bot argues about the request itself', async () => {
  const classic = JSON.parse((await run(['--json'])).stdout);
  assert.equal(classic.claim, STYLES.classic.defaultTopic);
  const plain = JSON.parse((await run(['--json', '--plain'])).stdout);
  assert.equal(plain.claim, STYLES.plain.defaultTopic);
  const civic = JSON.parse((await run(['--json', '--civic'])).stdout);
  assert.equal(civic.claim, STYLES.civic.defaultTopic);
});
