import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  classifyTurn,
  detectLean,
  openingLines,
  talkReply,
  createTalkState,
  formatBeat,
  runTalk,
} from '../src/talk.js';
import { argue } from '../src/argubot.js';

const CLI = fileURLToPath(new URL('../bin/argubot.js', import.meta.url));

function runCli(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
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
  assert.match(reply.text, /^YES$/m);
  assert.match(reply.text, /^NO$/m);
  assert.match(reply.text, /^GARY$/m);
  assert.match(reply.text, /^  No\.$/m);
  assert.match(reply.text, /more · new topic · done/);
  assert.doesNotMatch(reply.text, /justichuu|github\.com|LINEAGE|src\//i);
});

test('leaning yes still argues both sides and does not lead with yes', () => {
  let state = createTalkState();
  const started = talkReply(state, 'pineapple on pizza');
  const leaned = talkReply(started.state, 'yes');
  const yesAt = leaned.text.indexOf('\nYES\n');
  const noAt = leaned.text.indexOf('\nNO\n');
  assert.ok(noAt > 0 && yesAt > noAt, 'NO should speak first when the person leaned yes');
  assert.match(leaned.text, /You leaned yes/);
  assert.match(leaned.text, /^YES$/m);
  assert.match(leaned.text, /^NO$/m);
});

test('leaning no still argues both sides and does not lead with no', () => {
  const started = talkReply(createTalkState(), 'standing desks');
  const leaned = talkReply(started.state, 'no');
  const yesAt = leaned.text.indexOf('\nYES\n');
  const noAt = leaned.text.indexOf('\nNO\n');
  assert.ok(yesAt > 0 && noAt > yesAt, 'YES should speak first when the person leaned no');
  assert.match(leaned.text, /You leaned no/);
});

test('done is always a way out', () => {
  const reply = talkReply(createTalkState({ topic: 'cats' }), 'done');
  assert.equal(reply.exit, true);
  assert.match(reply.text, /I did not pick/);
});

test('more needs a topic, then adds another pair', () => {
  assert.match(talkReply(createTalkState(), 'more').text, /Say a thing first/);
  const started = talkReply(createTalkState(), 'tabs over spaces');
  const more = talkReply(started.state, 'more');
  assert.match(more.text, /Another pair/);
  assert.notEqual(started.text, more.text);
});

test('a lean without a topic is refused', () => {
  const reply = talkReply(createTalkState(), 'yes');
  assert.match(reply.text, /Say the thing first/);
});

test('formatted beats stay even and never pick a winner', () => {
  const debate = argue({ topic: 'getting a dog', rounds: 1, seed: 'talk-1', style: 'plain' });
  const text = formatBeat(debate, { hear: true });
  assert.match(text, /Even|Close enough/);
  assert.doesNotMatch(text, /\b(the winner is|yes wins|no wins|i conclude)\b/i);
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
  assert.match(output, /Say a thing/);
  assert.match(output, /You said pineapple on pizza/);
  assert.match(output, /You leaned yes/);
  assert.match(output, /I did not pick/);
  assert.doesNotMatch(output, /justichuu|github\.com|src\/talk/i);
});

test('the CLI talk loop reads lines and exits', async () => {
  const { stdout } = await runCli(['--talk', '--plain'], {
    input: 'hot dogs are sandwiches\nmore\ndone\n',
  });
  assert.match(stdout, /Say a thing/);
  assert.match(stdout, /You said hot dogs are sandwiches/);
  assert.match(stdout, /Another pair/);
  assert.match(stdout, /I did not pick/);
});
