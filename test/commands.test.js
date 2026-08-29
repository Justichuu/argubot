import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, parseSlash, resolveCommand, formatCommandList } from '../src/commands.js';
import { generateName } from '../src/names.js';
import { makeRng, hashString } from '../src/rng.js';
import { argue } from '../src/argubot.js';
import { burrito } from '../src/burrito.js';
import { classifyTurn, talkReply, createTalkState } from '../src/talk.js';

test('slash and bare tokens resolve to the same commands', () => {
  assert.equal(resolveCommand('/talk'), 'talk');
  assert.equal(resolveCommand('talk'), 'talk');
  assert.equal(resolveCommand('/burrito'), 'burrito');
  assert.equal(resolveCommand('/all'), 'burrito');
  assert.equal(parseSlash('/style civic').command, 'style');
  assert.equal(parseSlash('/style civic').rest, 'civic');
});

test('parseArgs accepts /commands and dashed flags together', () => {
  const talk = parseArgs(['/talk', '--plain', 'pineapple']);
  assert.equal(talk.command, 'talk');
  assert.equal(talk.style, 'plain');
  assert.equal(talk.topic, 'pineapple');
  assert.equal(talk.dissent, false);

  const loaded = parseArgs(['/burrito', '--dissent', '--seed', 'monday', 'hot dogs']);
  assert.equal(loaded.command, 'burrito');
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

test('a burrito serves every style and keeps dissent nameless when off', () => {
  const plate = burrito({ topic: 'pineapple on pizza', rounds: 2 });
  assert.equal(plate.servings.length, 3);
  assert.equal(plate.dissent, false);
  for (const serving of plate.servings) {
    assert.equal(serving.dissent, null);
    assert.equal(serving.for.length, 2);
  }
  const loud = burrito({ topic: 'pineapple on pizza', rounds: 2, dissent: true, seed: 'plate' });
  const names = new Set(loud.servings.map((serving) => serving.dissent.name));
  assert.equal(names.size, 1);
  assert.notEqual([...names][0].toLowerCase(), 'gary');
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

test('the command list is printable', () => {
  const list = formatCommandList();
  assert.match(list, /\/talk/);
  assert.match(list, /\/burrito/);
  assert.match(list, /\/validate/);
});
