import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { argue, normalizeClaim, MAX_ROUNDS, DEFAULT_TOPIC } from '../src/argubot.js';
import { measure, auditDebate, countWords } from '../src/audit.js';
import { FAMILIES } from '../src/rhetoric.js';
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

test('every rhetorical family is mirrored across both sides', () => {
  for (const family of FAMILIES) {
    assert.equal(typeof family.for, 'function', `${family.id} needs a for-side`);
    assert.equal(typeof family.against, 'function', `${family.id} needs an against-side`);
    const forLine = family.for('the matter of testing');
    const againstLine = family.against('the matter of testing');
    assert.notEqual(forLine, againstLine, `${family.id} argues itself`);
    assert.match(forLine, /[.!?]$/, `${family.id} for-side needs terminal punctuation`);
    assert.match(againstLine, /[.!?]$/, `${family.id} against-side needs terminal punctuation`);
  }
});

test('family ids are unique', () => {
  const ids = FAMILIES.map((family) => family.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('both sides always get the same number of arguments', () => {
  for (const topic of TOPICS) {
    for (let rounds = 1; rounds <= MAX_ROUNDS; rounds += 1) {
      const debate = argue({ topic, rounds });
      assert.equal(debate.for.length, rounds, `for-side length for "${topic}"`);
      assert.equal(debate.against.length, rounds, `against-side length for "${topic}"`);
    }
  }
});

test('the bias audit balances every topic within tolerance', () => {
  for (const topic of TOPICS) {
    for (let rounds = 1; rounds <= 6; rounds += 1) {
      const debate = argue({ topic, rounds, tolerance: 2 });
      assert.ok(
        debate.audit.balanced,
        `"${topic}" (${rounds} rounds) drifted by ${debate.audit.wordDelta} words`,
      );
    }
  }
});

test('a tolerance of zero produces an exact word-count tie', () => {
  const debate = argue({ topic: 'cereal is a soup', rounds: 4, tolerance: 0 });
  assert.equal(debate.audit.wordDelta, 0);
  assert.equal(debate.audit.for.words, debate.audit.against.words);
});

test('same topic and seed produce an identical debate', () => {
  const first = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4 });
  const second = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4 });
  assert.deepEqual(first, second);
});

test('a different seed produces a different debate', () => {
  const monday = argue({ topic: 'pineapple on pizza', seed: 'monday', rounds: 4 });
  const friday = argue({ topic: 'pineapple on pizza', seed: 'friday', rounds: 4 });
  assert.notDeepEqual(monday.for, friday.for);
});

test('rounds are clamped instead of throwing', () => {
  assert.equal(argue({ topic: 'anything', rounds: 0 }).rounds, 1);
  assert.equal(argue({ topic: 'anything', rounds: 999 }).rounds, MAX_ROUNDS);
});

test('Gary says no, and only no', () => {
  for (const topic of TOPICS) {
    const debate = argue({ topic, rounds: 3 });
    assert.equal(debate.gary.statement, 'No.');
  }
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
  assert.equal(normalizeClaim(''), DEFAULT_TOPIC);
  assert.equal(normalizeClaim('   '), DEFAULT_TOPIC);
  assert.equal(normalizeClaim(undefined), DEFAULT_TOPIC);
});

test('claims keep their own clause when they already have one', () => {
  assert.equal(normalizeClaim('whether birds are real'), 'whether birds are real');
  assert.equal(normalizeClaim('if the dress was blue'), 'if the dress was blue');
  assert.equal(normalizeClaim('that cereal is a soup'), 'that cereal is a soup');
  assert.equal(normalizeClaim('pineapple on pizza'), 'the matter of pineapple on pizza');
  assert.equal(normalizeClaim('pineapple on pizza???'), 'the matter of pineapple on pizza');
});

test('the verdict never picks a side', () => {
  const forbidden = /\b(therefore (for|against)|the winner is|i conclude that)\b/i;
  for (const topic of TOPICS) {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      assert.doesNotMatch(argue({ topic, seed, rounds: 2 }).verdict, forbidden);
    }
  }
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

test('rendering stays inside the requested width', () => {
  const debate = argue({ topic: 'renaming every street after Gary', rounds: 5 });
  const output = render(debate, { color: false, width: 60 });
  for (const line of output.split('\n')) {
    assert.ok(line.length <= 60, `line exceeded width: ${line}`);
  }
});

test('rendered output contains both sides and the audit', () => {
  const output = render(argue({ topic: 'pineapple on pizza', rounds: 2 }), { color: false });
  assert.match(output, /^FOR$/m);
  assert.match(output, /^AGAINST$/m);
  assert.match(output, /BIAS AUDIT/);
  assert.match(output, /BALANCED/);
  assert.match(output, /VERDICT:/);
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

test('the CLI emits valid JSON on request', async () => {
  const { stdout } = await run(process.execPath, [CLI, 'standing', 'desks', '--json', '--rounds', '4']);
  const debate = JSON.parse(stdout);
  assert.equal(debate.for.length, 4);
  assert.equal(debate.against.length, 4);
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
});

test('the CLI has help and version', async () => {
  const help = await run(process.execPath, [CLI, '--help']);
  assert.match(help.stdout, /nonbiased argument bot/);
  const version = await run(process.execPath, [CLI, '--version']);
  assert.match(version.stdout, /argubot \d+\.\d+\.\d+/);
});

test('with no topic at all the bot argues about the request itself', async () => {
  const { stdout } = await run(process.execPath, [CLI, '--json']);
  const debate = JSON.parse(stdout);
  assert.equal(debate.claim, DEFAULT_TOPIC);
});
