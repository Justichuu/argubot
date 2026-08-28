import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { argue, normalizeClaim, maxRounds, STYLE_NAMES, DEFAULT_STYLE } from '../src/argubot.js';
import { measure, auditDebate, countWords } from '../src/audit.js';
import { STYLES } from '../src/styles.js';
import { PLAIN_FAMILIES } from '../src/plain.js';
import { render } from '../src/render.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../bin/argubot.js', import.meta.url));

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

test('there are at least two styles and classic is the default', () => {
  assert.ok(STYLE_NAMES.length >= 2);
  assert.equal(DEFAULT_STYLE, 'classic');
  assert.deepEqual(STYLE_NAMES.sort(), ['classic', 'plain']);
});

for (const styleName of ['classic', 'plain']) {
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

test('the two styles produce genuinely different debates about the same topic', () => {
  const classic = argue({ topic: 'pineapple on pizza', rounds: 3, style: 'classic' });
  const plain = argue({ topic: 'pineapple on pizza', rounds: 3, style: 'plain' });
  assert.notDeepEqual(classic.for, plain.for);
  assert.notEqual(classic.claim, plain.claim);
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
});

test('rendering without color emits no escape codes', () => {
  const output = render(argue({ topic: 'tabs over spaces', rounds: 2 }), { color: false });
  assert.doesNotMatch(output, /\u001b\[/);
});

test('the CLI prints a debate', async () => {
  const { stdout } = await run(process.execPath, [CLI, 'pineapple', 'on', 'pizza']);
  assert.match(stdout, /THE QUESTION OF THE MATTER OF PINEAPPLE ON PIZZA/);
  assert.match(stdout, /^FOR$/m);
  assert.match(stdout, /^AGAINST$/m);
  assert.match(stdout, /^GARY \(independent\)$/m);
});

test('the CLI speaks common language on request', async () => {
  for (const flag of ['--plain', '-p', '--style plain']) {
    const { stdout } = await run(process.execPath, [CLI, 'pineapple on pizza', ...flag.split(' ')]);
    assert.match(stdout, /ARGUING ABOUT PINEAPPLE ON PIZZA/, `flag ${flag}`);
    assert.match(stdout, /^WHY YES$/m, `flag ${flag}`);
    assert.match(stdout, /^WHY NO$/m, `flag ${flag}`);
    assert.doesNotMatch(stdout, /THE QUESTION OF/, `flag ${flag}`);
  }
});

test('the CLI emits valid JSON on request', async () => {
  const { stdout } = await run(process.execPath, [CLI, 'standing', 'desks', '--json', '--rounds', '4']);
  const debate = JSON.parse(stdout);
  assert.equal(debate.for.length, 4);
  assert.equal(debate.against.length, 4);
  assert.equal(debate.style, 'classic');
  assert.equal(debate.gary.statement, 'No.');
  assert.equal(debate.audit.balanced, true);
});

test('the CLI rejects nonsense options with exit code 2', async () => {
  await assert.rejects(
    () => run(process.execPath, [CLI, '--rounds', 'banana']),
    (error) => error.code === 2 && /positive number/.test(error.stderr),
  );
  await assert.rejects(
    () => run(process.execPath, [CLI, '--whats-your-bias']),
    (error) => error.code === 2 && /unknown option/.test(error.stderr),
  );
  await assert.rejects(
    () => run(process.execPath, [CLI, 'pizza', '--style', 'interpretive-dance']),
    (error) => error.code === 2 && /unknown style/.test(error.stderr),
  );
});

test('the CLI has help and version', async () => {
  const help = await run(process.execPath, [CLI, '--help']);
  assert.match(help.stdout, /nonbiased argument bot/);
  assert.match(help.stdout, /common language/);
  const version = await run(process.execPath, [CLI, '--version']);
  assert.match(version.stdout, /argubot \d+\.\d+\.\d+/);
});

test('with no topic at all the bot argues about the request itself', async () => {
  const classic = JSON.parse((await run(process.execPath, [CLI, '--json'])).stdout);
  assert.equal(classic.claim, STYLES.classic.defaultTopic);
  const plain = JSON.parse((await run(process.execPath, [CLI, '--json', '--plain'])).stdout);
  assert.equal(plain.claim, STYLES.plain.defaultTopic);
});
