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
  coinFace,
  coinToss,
  tossWithHand,
  handFromWord,
  landFromZ,
  battleName,
  formatBeat,
  COIN_H,
  COIN_D,
  COIN_BAND,
  LINE_LIMIT_BASELINE,
  runTalk,
  runValidate,
  rollVisitor,
  audioFromRoll,
  quotesFromRoll,
  SENTENCE_QUOTES,
  ENGLISH_NAMES,
  OWN_REVIEW,
  clipOwnReview,
  REVIEW_COUNT,
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
  assert.match(plain, /^WHY MAYBE$/m);
  assert.match(plain, /pineapple on pizza is a fix/);
  assert.match(plain, /pineapple on pizza makes more problems/);
  assert.match(plain, /pineapple on pizza is a gray area/);
  assert.doesNotMatch(plain, /Also maybe/);
  assert.match(plain, /Check:/);
  assert.match(plain, /FAIRNESS CHECK/);
  assert.match(plain, /EVEN/);
  assert.match(plain, /SO WHO WINS:/);

  const classic = render(argue({ topic: 'pineapple on pizza', rounds: 2, style: 'classic' }), { color: false });
  assert.match(classic, /^FOR$/m);
  assert.match(classic, /^AGAINST$/m);
  assert.match(classic, /^MAYBE$/m);
  assert.match(classic, /BIAS AUDIT/);
  assert.match(classic, /BALANCED/);
  assert.match(classic, /VERDICT:/);

  const civic = render(argue({ topic: 'pineapple on pizza', rounds: 2, style: 'civic' }), { color: false });
  assert.match(civic, /^THE CASE FOR$/m);
  assert.match(civic, /^THE CASE AGAINST$/m);
  assert.match(civic, /^MAYBE$/m);
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
  assert.match(html, /class="skip"[^>]*>Skip</);
  assert.match(html, /id="letter"/);
  assert.match(html, /100svh/);
  const skin = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const rules = skin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/body::after\s*\{[\s\S]*?\n\s*\}/, '');
  assert.doesNotMatch(rules, /min-height:\s*100(?:vh|svh|dvh|lvh)/, 'html/body must not stretch past the letter');
  assert.match(rules, /html,\s*body\s*\{[^}]*min-height:\s*0/, 'letter lock: min-height 0');
  assert.match(rules, /html,\s*body\s*\{[^}]*height:\s*auto/, 'letter lock: height auto');
  assert.match(skin, /body::after[\s\S]*100svh/);
  assert.match(html, /safe-area-inset/);
  assert.match(html, /min-height:\s*44px/);
  assert.match(html, /This stays here\./);
  assert.match(html, /It does not call this website/);
  assert.match(html, /Nothing is sent\./);
  assert.match(html, /wip-stamp/);
  assert.match(html, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(html, /Here and Instructions/);
  assert.doesNotMatch(html, /<summary[^>]*>Instructions<\/summary>/);
  assert.doesNotMatch(html, /The box is the thing/);
  assert.doesNotMatch(html, /class="here"/);
  assert.doesNotMatch(html, /id="acc_full"/);
  assert.doesNotMatch(html, /id="acc_here"/);
  assert.doesNotMatch(html, /id="acc_head"/);
  assert.doesNotMatch(html, /<html[^>]*\bfull\b/);
  assert.match(html, /id="letter"[^>]*role="main"/);
  assert.match(html, /This stays here\. It does not call this website\. Nothing is sent\./);
  assert.doesNotMatch(html, /Close the tab and it's gone/);
  assert.doesNotMatch(html, /I don't know what I did/);
  assert.doesNotMatch(html, /The irony is|irony is |\u2e2e/i);
  assert.doesNotMatch(html, /Who is this for\. People on earth/);
  assert.doesNotMatch(html, /Box is biggest|Stamp is the red thing|Face is the film/);
  assert.match(html, /<summary[^>]*>video<\/summary>/);
  assert.match(html, /button:hover[\s\S]*background: var\(--ink\)/);
  assert.doesNotMatch(html, /#argue \{[^}]*linear-gradient/);
  assert.doesNotMatch(html, /#pesky \{[^}]*#ff7a18/);
  assert.doesNotMatch(html, /html\.full/);
  assert.match(html, /class="site-links"/);
  assert.match(html, /aria-label="ChuuMind"/);
  assert.match(html, /chuumind.com\/tools\//);
  assert.match(html, /id="acc_ink"[^>]*title="Ink\."/);
  assert.match(html, /html\.lamp/);
  assert.match(html, /html\.access-big/);
  assert.match(html, /html\.access-bigger/);
  assert.doesNotMatch(html, /comedy if it is funny\. Or not\./);
  assert.doesNotMatch(html, /human if technology takes away\. Or not\./);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.doesNotMatch(html, /Type\. Argue\. Nothing is sent\./);
  assert.match(html, /chuumind.com\/book\//);
  assert.match(html, /chuumind.com\/rights\//);
  assert.match(html, /chuumind.com\/privacy\//);
  assert.match(html, /chuumind.com\/attributions\//);
  assert.match(html, /id="acc_speak"[^>]*title="Speak\."/);
  assert.match(html, /src="\.\/argubot\.js"/);
  assert.match(html, /id="argue"[^>]*title="Both sides\."/);
  assert.match(html, /id="yes"[^>]*title="Your side\."/);
  assert.match(html, /id="no"[^>]*title="Your side\."/);
  assert.match(html, /id="maybe"[^>]*title="Gray\."/);
  assert.match(html, /id="more"[^>]*title="More\."/);
  assert.match(html, /id="done"[^>]*title="Out\."/);
  assert.match(html, /content: attr\(title\)/);
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
  assert.match(html, /uncensored/);
  assert.match(html, /No weights\. No bias\. Even scale/);
  assert.match(html, /zeightgeist proven solutions/);
  assert.match(html, /actual correct solution/);
  assert.match(html, /\(fix\) mode/);
  assert.match(html, /best logic it feels if it's actual true/);
  assert.match(html, /I let go of the wheel|I'll let go of the wheel/);
  assert.match(html, /ranked choice voting/);
  assert.match(html, /Hallucinations are accepted/);
  assert.match(html, /world would\(not\) be either/);
  assert.match(html, /Next turn/);
  assert.match(html, /Certainly is ego/);
  assert.match(html, /Ego is hubris/);
  assert.match(html, /Everything is not\. Or is\. Gray area/);
  assert.match(html, /Metaphor is a metaphor for metaphor/);
  assert.match(html, /A metaphor for metaphor is nothing/);
  assert.match(html, /Or is something to someone/);
  assert.match(html, /Self-referential/);
  assert.match(html, /Self carrying/);
  assert.match(html, /Rules don't work because no one follows them/);
  assert.match(html, /After they themselves decay and forget the rules/);
  assert.match(html, /I don't write manifestos/);
  assert.match(html, /Weirdos do that I admire/);
  assert.match(html, /Hubris, as I just wrote one/);
  assert.match(html, /no one wants to read them sometimes/);
  assert.match(html, /Sometimes people do but not all the time/);
  assert.match(html, /Saying something doesn't make it true for everyone witnessing or not witnessing/);
  const body = html.slice(html.indexOf('<body>'));
  assert.match(body, /It's me as a bot, not really funny\./);
  assert.doesNotMatch(body, /Not really that funny|Not confirmed comedy gold/);
  assert.equal((body.match(/It's me as a bot, not really funny\./g) || []).length, 1);
  assert.doesNotMatch(body, /The irony is|irony is |\u2e2e/i);
  assert.doesNotMatch(body, /bullshit|I hate it/i);
  assert.ok(body.indexOf('id="thing"') > 0);
  assert.ok(body.indexOf('id="thing"') < body.indexOf('id="out"'));
  assert.ok(html.indexOf('principal of its existence') < html.indexOf('<body>'), 'the long text stays in meta so the page stays small');
  assert.doesNotMatch(html, /How it talks|name="style"|value="civic"|value="classic"|Lean yes|book voice/i);
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage/);
  assert.doesNotMatch(html, /sessionStorage/);
  assert.doesNotMatch(html, /indexedDB/);
  assert.match(html, /id="customer-lines"/);
  assert.match(html, /id="pesky"/);
  assert.match(html, /Pesky reviews/);
  assert.match(html, /id="pesky-box"[^>]*\bhidden\b/);
  assert.match(html, /Not saved\./);
  assert.doesNotMatch(html, /How these lines got here/);
  assert.match(html, /placeholder="Type a thing\."/);
  assert.match(html, /#argue \{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(html, /English names\. Other languages\. One is gibberish\. Random stars\./);
  assert.match(html, /Leave your own review/);
  assert.match(html, /id="own-review"/);
  assert.match(html, /class="review-cards"/);
  assert.doesNotMatch(html, /\b[Ll]ie\b/);
  assert.doesNotMatch(html, /captcha|recaptcha|biometric/i);
  assert.match(html, /--accent:\s*#ff4d2e/);
  assert.match(html, /--halo:\s*#ffd84a/);
  assert.match(html, /--mint:\s*#3dffb0/);
  assert.match(html, /--cyan:\s*#3ec6ff/);
  assert.match(html, /--violet:\s*#b44cff/);
  assert.match(html, /wrap letter/);
  assert.match(html, /class="squiggle"/);
  assert.match(html, /title="Type\. Feel\. Vibe\."/);
  assert.match(html, /html\.feel/);
  assert.match(html, /html\.vibe/);
  assert.doesNotMatch(html, /Type \+|Type \+\+/);
  const src = readFileSync(new URL('./argubot.js', import.meta.url), 'utf8');
  assert.match(src, /\['Type', 'Feel', 'Vibe'\]/);
  assert.match(src, /typeLevel === 1 && 'type'/);
  assert.match(src, /typeLevel === 2 && 'type2'/);
  assert.match(src, /classList\.toggle\('access-big'/);
  assert.match(src, /classList\.toggle\('access-bigger'/);
  assert.match(src, /classList\.contains\('lamp'\) && 'ink'/);
  assert.match(src, /getElementById\('acc_ink'\)/);
  assert.doesNotMatch(src, /\u2e2e/);
  assert.doesNotMatch(html, /chuumind\.com\/styles\.css|chuumind\.com\/access\.js/);
  assert.match(html, /<div id="out"/);
  assert.match(html, /#out strong \{ font-weight: 800; font-style: italic/);
  assert.match(html, /#out \.mark/);
  assert.match(html, /font-variant: small-caps/);
  assert.match(html, /#out \.think/);
  assert.match(html, /#out \.caret/);
  assert.match(src, /streamTok/);
  assert.match(src, /createElement\('strong'\)/);
  assert.match(src, /createElementNS/);
  assert.match(src, /PACE/);
  assert.match(src, /word:\s*320/);
  assert.match(src, /think:\s*96/);
  assert.doesNotMatch(src, /await wait\(18\)/);
  assert.doesNotMatch(src, /await wait\(28\)/);
  assert.match(src, /embedVec/);
  assert.match(src, /vec coin/);
  assert.match(src, /vec axis/);
  assert.match(src, /getRandomValues/);
  assert.match(src, /handFromWord/);
  assert.match(src, /tossWithHand/);
  assert.match(src, /performance\.now/);
  assert.match(src, /Math\.hypot/);
  assert.match(src, /live: true/);
  assert.doesNotMatch(src, /rare % LINE_LIMIT|LINE_LIMIT_BASELINE === 0/);
  assert.match(src, /id === 'maybe'/);
  assert.match(src, /speakLine/);
  assert.match(html, /#out \.vec/);
  assert.match(html, /#out \.vec\.axis/);
  assert.match(html, /@keyframes coin-spin/);
  assert.doesNotMatch(html, /rotateY/);
  assert.match(html, /#out \.vec\.coin \{/);
  assert.match(html, /@keyframes think-draw/);
  assert.match(html, /@keyframes vec-draw/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(src, /charCodeAt\(0\) === 0x200b/);
  assert.match(src, /scrollIntoView/);
  assert.match(src, /livvil/);
  assert.doesNotMatch(src, /innerHTML/);
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
  assert.equal(detectLean('maybe'), 'maybe');
  assert.equal(detectLean('but that sounds expensive'), 'against');
  assert.equal(detectLean('whether yes men are useful'), null);
  assert.equal(detectLean('maybe we should get a dog'), null);
  assert.equal(classifyTurn('yes').kind, 'lean');
  assert.equal(classifyTurn('maybe').kind, 'lean');
  assert.equal(classifyTurn('maybe we should get a dog').kind, 'topic');
  assert.equal(classifyTurn('whether yes men are useful').kind, 'topic');
  assert.equal(classifyTurn('done').kind, 'exit');
  assert.equal(classifyTurn('3').kind, 'exit');
  assert.equal(classifyTurn('more').kind, 'more');
  assert.equal(classifyTurn('fix').kind, 'fix');
  assert.equal(classifyTurn('fix the roads').kind, 'topic');
  assert.equal(classifyTurn('metaphor').kind, 'metaphor');
  assert.equal(classifyTurn('metaphor is nothing').kind, 'topic');
  assert.equal(classifyTurn('comedy').kind, 'comedy');
  assert.equal(classifyTurn('gold').kind, 'comedy');
  assert.equal(classifyTurn('funny').kind, 'comedy');
  assert.equal(classifyTurn('who').kind, 'comedy');
  assert.equal(classifyTurn('who is this for').kind, 'comedy');
  assert.equal(classifyTurn('who is this for?').kind, 'comedy');
  assert.equal(classifyTurn('feature').kind, 'comedy');
  assert.equal(classifyTurn('normal').kind, 'comedy');
  assert.equal(classifyTurn('customize').kind, 'comedy');
  assert.equal(classifyTurn('human').kind, 'human');
  assert.equal(classifyTurn('tech').kind, 'human');
  assert.equal(classifyTurn('technology').kind, 'human');
  assert.equal(classifyTurn('earth').kind, 'earth');
  assert.equal(classifyTurn('sense').kind, 'earth');
  assert.equal(classifyTurn('none of this makes sense').kind, 'earth');
  assert.equal(classifyTurn('None of this makes sense to anyone mostly on earth').kind, 'earth');
  assert.notEqual(classifyTurn('\u2e2e').kind, 'earth');
  assert.notEqual(classifyTurn('/\u2e2e').kind, 'earth');
  assert.equal(classifyTurn('?').kind, 'help');
  assert.equal(classifyTurn('funny pizza').kind, 'topic');
  assert.equal(classifyTurn('gold rush').kind, 'topic');
  assert.equal(classifyTurn('who should run').kind, 'topic');
  assert.equal(classifyTurn('human rights').kind, 'topic');
  assert.equal(classifyTurn('tech support').kind, 'topic');
  assert.equal(classifyTurn('feature pizza').kind, 'topic');
  assert.equal(classifyTurn('earth day').kind, 'topic');
  assert.equal(classifyTurn('sense of smell').kind, 'topic');
  assert.equal(classifyTurn('manners').kind, 'manners');
  assert.equal(classifyTurn('table manners').kind, 'topic');
  assert.equal(classifyTurn('battle').kind, 'battle');
  assert.equal(classifyTurn('goil').kind, 'battle');
  assert.equal(classifyTurn('evod').kind, 'battle');
  assert.equal(classifyTurn('livvil').kind, 'battle');
  assert.equal(classifyTurn('battle cry').kind, 'topic');
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
  assert.match(reply.text, /^MAYBE$/m);
  assert.doesNotMatch(reply.text, /^GARY$/m);
  assert.match(reply.text, /^pineapple on pizza is a fix\.$/m);
  assert.match(reply.text, /^pineapple on pizza makes more problems\.$/m);
  assert.match(reply.text, /^pineapple on pizza is a gray area\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.match(reply.text, /Check:/);
  assert.doesNotMatch(reply.text, /justichuu|github\.com|LINEAGE|src\//i);
});

test('leaning yes still argues both sides and does not lead with yes', () => {
  let state = createTalkState();
  const started = talkReply(state, 'pineapple on pizza');
  const leaned = talkReply(started.state, 'yes');
  const yesAt = leaned.text.indexOf('\nYES\n');
  const noAt = leaned.text.indexOf('\nNO\n');
  assert.ok(noAt > 0 && yesAt > noAt, 'NO should speak first when the person said yes');
  assert.match(leaned.text, /You said yes\. NO first\./);
  assert.match(leaned.text, /^YES$/m);
  assert.match(leaned.text, /^NO$/m);
  assert.match(leaned.text, /^MAYBE$/m);
});

test('leaning no still argues both sides and does not lead with no', () => {
  const started = talkReply(createTalkState(), 'standing desks');
  const leaned = talkReply(started.state, 'no');
  const yesAt = leaned.text.indexOf('\nYES\n');
  const noAt = leaned.text.indexOf('\nNO\n');
  assert.ok(yesAt > 0 && noAt > yesAt, 'YES should speak first when the person said no');
  assert.match(leaned.text, /You said no\. YES first\./);
});

test('leaning maybe leads with maybe and does not flip a coin', () => {
  const started = talkReply(createTalkState(), 'standing desks');
  const leaned = talkReply(started.state, 'maybe');
  const maybeAt = leaned.text.search(/^MAYBE$/m);
  const yesAt = leaned.text.search(/^YES$/m);
  const noAt = leaned.text.search(/^NO$/m);
  assert.ok(maybeAt >= 0 && maybeAt < yesAt && yesAt < noAt);
  assert.match(leaned.text, /You said maybe\. MAYBE first\./);
  assert.doesNotMatch(leaned.text, /bot flips coin|bot lands on/);
});

test('done is always a way out', () => {
  const reply = talkReply(createTalkState({ topic: 'cats' }), 'done');
  assert.equal(reply.exit, true);
  assert.match(reply.text, /I did not pick/);
  assert.match(reply.text, /Chill/);
  assert.match(reply.text, /Let it go/);
  assert.match(reply.text, /I let go of the wheel/);
});

test('more needs a topic, then adds another pair', () => {
  assert.match(talkReply(createTalkState(), 'more').text, /Type it first/);
  const started = talkReply(createTalkState(), 'tabs over spaces');
  const more = talkReply(started.state, 'more');
  assert.match(more.text, /^YES$/m);
  assert.match(more.text, /^NO$/m);
  assert.match(more.text, /^MAYBE$/m);
  assert.notEqual(started.text, more.text);
});

test('a lean without a topic is refused', () => {
  const reply = talkReply(createTalkState(), 'yes');
  assert.match(reply.text, /Type it first/);
});

test('metaphor is the name, which is nothing, or something to someone', () => {
  assert.equal(classifyTurn('/metaphor').kind, 'metaphor');
  const reply = talkReply(createTalkState({ seed: 'metaphor' }), 'metaphor');
  assert.match(reply.text, /You said Metaphor is a metaphor for metaphor/);
  assert.match(reply.text, /^Metaphor is a metaphor for metaphor\.$/m);
  assert.match(reply.text, /^a metaphor for metaphor is nothing\.$/m);
  assert.match(reply.text, /^Or is something to someone\.$/m);
  assert.match(reply.text, /^MAYBE$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /Your mom would|ancestors|0\.4%|I did Metaphor/i);
  const started = talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza');
  const named = talkReply(started.state, 'metaphor');
  assert.match(named.text, /^Metaphor is a metaphor for metaphor\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
  const debate = argue({ topic: 'Metaphor is a metaphor for metaphor.', style: 'classic' });
  assert.equal(debate.claim, 'Metaphor is a metaphor for metaphor');
  assert.equal(debate.rounds, 0);
});

test('comedy is only funny to people who laugh, or more people, not gold', () => {
  assert.equal(classifyTurn('/comedy').kind, 'comedy');
  assert.equal(classifyTurn('/gold').kind, 'comedy');
  assert.equal(classifyTurn('/funny').kind, 'comedy');
  const reply = talkReply(createTalkState({ seed: 'comedy' }), 'comedy');
  assert.match(reply.text, /You said this is only funny to people who laugh at it/);
  assert.match(reply.text, /^this is only funny to people who laugh at it\. A feature you could add\.$/m);
  assert.match(reply.text, /^this is a normal thing for normal people\.$/m);
  assert.match(reply.text, /^Not confirmed comedy gold\.$/m);
  assert.match(reply.text, /^MAYBE$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /crazy|girlfriend|Your mom would|ancestors|0\.4%|I did this is only funny/i);
  const gold = talkReply(createTalkState({ seed: 'gold' }), 'gold');
  assert.match(gold.text, /^this is only funny to people who laugh at it\. A feature you could add\.$/m);
  const named = talkReply(talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza').state, 'funny');
  assert.match(named.text, /^this is only funny to people who laugh at it\. A feature you could add\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
  const typed = talkReply(createTalkState({ seed: 'typed' }), 'not confirmed comedy gold');
  assert.match(typed.text, /^Not confirmed comedy gold\.$/m);
  const debate = argue({ topic: 'comedy gold', style: 'classic' });
  assert.equal(debate.claim, 'this is only funny to people who laugh at it');
  assert.equal(debate.rounds, 0);
  const who = talkReply(createTalkState({ seed: 'who' }), 'who is this for?');
  assert.match(who.text, /^this is only funny to people who laugh at it\. A feature you could add\.$/m);
  assert.match(who.text, /^this is a normal thing for normal people\.$/m);
  assert.doesNotMatch(who.text, /crazy|girlfriend/i);
  const feature = talkReply(createTalkState({ seed: 'feature' }), 'feature');
  assert.match(feature.text, /^this is a normal thing for normal people\.$/m);
  const normal = talkReply(createTalkState({ seed: 'normal' }), 'normal');
  assert.match(normal.text, /^this is only funny to people who laugh at it\. A feature you could add\.$/m);
});

test('human is technology taking away, or a normal thing you could add', () => {
  assert.equal(classifyTurn('/human').kind, 'human');
  assert.equal(classifyTurn('/tech').kind, 'human');
  assert.equal(classifyTurn('/technology').kind, 'human');
  const reply = talkReply(createTalkState({ seed: 'human' }), 'human');
  assert.match(reply.text, /You said Using technology takes away from the human experience in general/);
  assert.match(reply.text, /^using technology takes away from the human experience in general\.$/m);
  assert.match(reply.text, /^technology is a normal thing for normal people\.$/m);
  assert.match(reply.text, /^Or a feature you could add\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /crazy|girlfriend|Your mom would|ancestors|0\.4%/i);
  const typed = talkReply(createTalkState({ seed: 'typed' }), 'Using technology takes away from the human experience in general.');
  assert.match(typed.text, /^using technology takes away from the human experience in general\.$/m);
  const debate = argue({ topic: 'Using technology takes away from the human experience in general', style: 'classic' });
  assert.equal(debate.claim, 'Using technology takes away from the human experience in general');
  assert.equal(debate.rounds, 0);
  const started = talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza');
  const named = talkReply(started.state, 'tech');
  assert.match(named.text, /^using technology takes away from the human experience in general\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
});

test('earth is none of this making sense, or it does to someone', () => {
  assert.equal(classifyTurn('/earth').kind, 'earth');
  assert.equal(classifyTurn('/sense').kind, 'earth');
  const reply = talkReply(createTalkState({ seed: 'earth' }), 'earth');
  assert.match(reply.text, /You said None of this makes sense to anyone mostly on earth/);
  assert.match(reply.text, /^none of this makes sense to anyone mostly on earth\.$/m);
  assert.match(reply.text, /^it makes sense to someone\.$/m);
  assert.match(reply.text, /^Or to people who laugh at it\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /crazy|girlfriend|Your mom would|ancestors|0\.4%/i);
  const typed = talkReply(createTalkState({ seed: 'typed' }), 'None of this makes sense to anyone mostly on earth.');
  assert.match(typed.text, /^none of this makes sense to anyone mostly on earth\.$/m);
  const short = talkReply(createTalkState({ seed: 'short' }), 'none of this makes sense');
  assert.match(short.text, /^it makes sense to someone\.$/m);
  const debate = argue({ topic: 'None of this makes sense to anyone mostly on earth', style: 'classic' });
  assert.equal(debate.claim, 'None of this makes sense to anyone mostly on earth');
  assert.equal(debate.rounds, 0);
  const started = talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza');
  const named = talkReply(started.state, 'sense');
  assert.match(named.text, /^none of this makes sense to anyone mostly on earth\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
});

test('manners are important to most people, depending where they live', () => {
  assert.equal(classifyTurn('/manners').kind, 'manners');
  assert.equal(classifyTurn('manners').kind, 'manners');
  assert.equal(classifyTurn('Manners are important to most people.').kind, 'manners');
  assert.equal(classifyTurn('depending where they live').kind, 'manners');
  const reply = talkReply(createTalkState({ seed: 'manners' }), 'manners');
  assert.match(reply.text, /You said Manners are important to most people/);
  assert.match(reply.text, /^manners are important to most people\.$/m);
  assert.match(reply.text, /^depending where they live\.$/m);
  assert.match(reply.text, /^Important, depending where they live\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /crazy|girlfriend|Your mom would|ancestors|0\.4%/i);
  const typed = talkReply(createTalkState({ seed: 'typed' }), 'Manners are important to most people.');
  assert.match(typed.text, /^manners are important to most people\.$/m);
  const place = talkReply(createTalkState({ seed: 'place' }), 'depending where they live');
  assert.match(place.text, /^depending where they live\.$/m);
  const debate = argue({ topic: 'Manners are important to most people', style: 'classic' });
  assert.equal(debate.claim, 'Manners are important to most people');
  assert.equal(debate.rounds, 0);
  const started = talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza');
  const named = talkReply(started.state, 'manners');
  assert.match(named.text, /^manners are important to most people\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
});

test('in the battle between good and evil, neither win', () => {
  assert.equal(classifyTurn('/livvil').kind, 'battle');
  assert.equal(classifyTurn('goil').kind, 'battle');
  assert.equal(classifyTurn('evod').kind, 'battle');
  assert.equal(classifyTurn('In the battle between good and evil, neither win.').kind, 'battle');
  const reply = talkReply(createTalkState({ seed: 'battle' }), 'battle');
  assert.match(reply.text, /You said In the battle between good and evil, neither win/);
  assert.match(reply.text, /^goil would put good first\.$/m);
  assert.match(reply.text, /^evod would put evil first\.$/m);
  assert.match(reply.text, /^in the battle between good and evil, neither win\.$/m);
  assert.match(reply.text, /^YES$/m);
  assert.match(reply.text, /^NO$/m);
  assert.match(reply.text, /^MAYBE$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.doesNotMatch(reply.text, /^1\. /m);
  assert.doesNotMatch(reply.text, /crazy|girlfriend|Your mom would|ancestors|0\.4%/i);
  const typed = talkReply(createTalkState({ seed: 'typed' }), 'In the battle between good and evil, neither win.');
  assert.match(typed.text, /^in the battle between good and evil, neither win\.$/m);
  const other = talkReply(createTalkState({ seed: 'other' }), 'goil would put good first, evod would put evil first');
  assert.match(other.text, /^goil would put good first\.$/m);
  assert.match(other.text, /^evod would put evil first\.$/m);
  const debate = argue({ topic: 'In the battle between good and evil, neither win', style: 'classic' });
  assert.equal(debate.claim, 'In the battle between good and evil, neither win');
  assert.equal(debate.rounds, 0);
  const started = talkReply(createTalkState({ seed: 'switch' }), 'pineapple on pizza');
  const named = talkReply(started.state, 'livvil');
  assert.match(named.text, /^in the battle between good and evil, neither win\.$/m);
  assert.doesNotMatch(named.text, /pineapple on pizza is a fix/);
});

test('fix with no topic starts on LLMs and keeps an even scale', () => {
  const reply = talkReply(createTalkState({ seed: 'fix' }), 'fix');
  assert.match(reply.text, /You said LLMs need to be fixed/);
  assert.match(reply.text, /^LLMs need to be fixed is a fix\.$/m);
  assert.match(reply.text, /^LLMs need to be fixed makes more problems\.$/m);
  assert.match(reply.text, /^LLMs need to be fixed is a gray area\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  const yesAt = reply.text.indexOf('\nYES\n');
  const noAt = reply.text.indexOf('\nNO\n');
  const first = yesAt < noAt ? reply.text.slice(yesAt, noAt) : reply.text.slice(noAt, yesAt);
  const second = yesAt < noAt ? reply.text.slice(noAt) : reply.text.slice(yesAt);
  assert.equal((first.match(/^ {3}Check: /gm) || []).length, (second.match(/^ {3}Check: /gm) || []).length);
  assert.doesNotMatch(reply.text, /\b(the winner is|yes wins|no wins|i conclude|weight|weighted)\b/i);
});

test('formatted beats stay even and never pick a winner', () => {
  const debate = argue({ topic: 'getting a dog', rounds: 1, seed: 'talk-1', style: 'plain' });
  const text = formatBeat(debate, { hear: true });
  assert.match(text, /^YES$/m);
  assert.match(text, /^NO$/m);
  assert.match(text, /^MAYBE$/m);
  assert.equal(debate.audit.tolerance, 0);
  assert.equal(debate.audit.for.words, debate.audit.against.words);
  assert.doesNotMatch(text, /Also maybe/);
  assert.doesNotMatch(text, /\b(the winner is|yes wins|no wins|i conclude)\b/i);
});

test('talk will not print as many lines as it feels', () => {
  const debate = argue({ topic: 'getting a dog', rounds: 3, seed: 'cap', style: 'plain' });
  const full = formatBeat(debate, { hear: true });
  const keep = (line) => !line.startsWith('\u200b') && !/^(goil|evod|livvil)$/.test(line);
  const printed = full.split('\n').filter(keep);
  assert.ok(printed.length <= LINE_LIMIT_BASELINE);
  const tight = formatBeat(debate, { hear: true, limit: 12 });
  const tightPrinted = tight.split('\n').filter(keep);
  assert.ok(tightPrinted.length <= 12);
  const yesAt = tight.indexOf('\nYES\n');
  const noAt = tight.indexOf('\nNO\n');
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
  const mp4 = readFileSync(new URL('./argubot_demo.mp4', import.meta.url));
  const vtt = readFileSync(new URL('./argubot_demo.vtt', import.meta.url), 'utf8');
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  assert.ok(mp4.length > 0);
  assert.match(mp4.toString('latin1'), /mp4a/);
  assert.match(vtt, /^WEBVTT/m);
  assert.match(vtt, /Version 1\.5\.0/);
  assert.match(vtt, /bot flips coin/);
  assert.match(vtt, /bot lands on heads/);
  assert.match(readme, /argubot_demo\.mp4/);
  assert.match(readme, /argubot_demo\.vtt/);
  assert.doesNotMatch(readme, /argubot_demo\.gif/);
  assert.match(readme, /I hate it\./);
  assert.match(readme, /Dystopian ad bullshit/);
  assert.match(readme, /Cyberpunk nightmare fuel/);
  assert.match(readme, /The letter theme from chuumind\.com/);
  assert.ok(readme.indexOf('I hate it.') < readme.indexOf('argubot_demo.mp4'), 'readme does not show the face first');
  assert.doesNotMatch(html, /argubot_demo\.gif/);
  assert.match(html, /<details class="film-letter">/);
  assert.doesNotMatch(html, /<details class="film-letter"[^>]*\bopen\b/);
  assert.match(html, /<section class="film"/);
  const filmLetterAt = html.indexOf('<details class="film-letter">');
  const filmAt = html.indexOf('<section class="film"');
  const filmLetterEnd = html.indexOf('</details>', html.indexOf('</section>', filmAt));
  assert.ok(filmLetterAt > 0 && filmAt > filmLetterAt && filmAt < filmLetterEnd, 'the film stays closed in the letter');
  const src = readFileSync(new URL('./argubot.js', import.meta.url), 'utf8');
  assert.match(src, /querySelector\('\.film-letter'\)/);
  assert.doesNotMatch(src, /acc_head|acc_full|acc_here|fullOn|hereOn|headOn/);
  assert.match(html, /<summary[^>]*>Trigger me\. The face is in here\.<\/summary>/);
  assert.match(html, /class="film-trigger"/);
  assert.doesNotMatch(html, /<details class="film-trigger"[^>]*\bopen\b/);
  assert.doesNotMatch(html, /Trigger warning/);
  assert.match(html, /<strong>Uncanny\.<\/strong>/);
  assert.match(html, /robot face talks/);
  assert.match(html, /Do not open if you do not want that/);
  assert.match(html, /class="film-warn wip-stamp"/);
  assert.doesNotMatch(html, /idomath/i);
  const skipAt = html.indexOf('Skip this video and read its transcript');
  const warnAt = html.indexOf('<strong>Uncanny.</strong>');
  const triggerAt = html.indexOf('Trigger me. The face is in here.');
  const videoAt = html.indexOf('<video controls preload="none"');
  const closeAt = html.indexOf('</details>', triggerAt);
  assert.ok(skipAt > 0 && skipAt < warnAt, 'skip stays outside the face');
  assert.ok(warnAt > 0 && warnAt < triggerAt, 'the warning is in front of the flap');
  assert.ok(videoAt > triggerAt && videoAt < closeAt, 'the face stays inside Trigger me');
  assert.match(html, /<video controls preload="none" playsinline/);
  assert.match(html, /argubot_demo\.vtt/);
  assert.match(html, /label="English captions" default/);
  assert.match(html, /bot flips coin\. bot lands on heads/);
  assert.doesNotMatch(html, /\sautoplay\b|\sloop\b/);
});

test('every film frame sits in the box', () => {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const SQRT2 = Math.SQRT2;
  const FRAMES = 894;
  const FACE = 248;
  const MARGIN = 18;
  const W = 1280;
  const H = 800;

  const viseme = (rms, lo, hi) => {
    if (!Number.isFinite(rms) || rms < 0) return 0;
    if (rms <= lo) return 0;
    if (rms <= hi) return 1;
    return 2;
  };

  const hold = (seq, min = 2) => {
    const out = seq.slice();
    let last = out[0];
    let held = 1;
    for (let i = 1; i < out.length; i += 1) {
      if (out[i] === last) {
        held += 1;
        continue;
      }
      if (held < min) {
        out[i] = last;
        held += 1;
        continue;
      }
      last = out[i];
      held = 1;
    }
    return out;
  };

  const box = (n) => {
    const sx = FACE * (1 + 0.04 * Math.sin(n * PHI));
    const sy = FACE * (1 + 0.04 * Math.sin(n * SQRT2 + 1));
    const a = Math.abs(0.04 * Math.sin(n * SQRT2));
    const bw = sx * Math.cos(a) + sy * Math.sin(a);
    const bh = sx * Math.sin(a) + sy * Math.cos(a);
    const x = W - bw - MARGIN + ((Math.floor(n * PHI) % 3) - 1);
    const y = H - bh - MARGIN + ((Math.floor(n * SQRT2) % 5) - 2);
    return { x, y, bw, bh, viseme: n % 3 };
  };

  const raw = [];
  for (let n = 0; n < FRAMES; n += 1) raw.push(viseme((n * 97) % 4000, 0, 2154.5));
  const seq = hold(raw, 2);
  assert.equal(seq.length, FRAMES);
  assert.ok(seq.every((v) => v === 0 || v === 1 || v === 2));
  assert.equal(viseme(0, 0, 2154.5), 0);
  assert.equal(viseme(100, 0, 2154.5), 1);
  assert.equal(viseme(4000, 0, 2154.5), 2);

  for (let n = 0; n < FRAMES; n += 1) {
    const b = box(n);
    assert.ok(b.bw > 200 && b.bh > 200);
    assert.ok(b.x >= 0, `x ${b.x} on ${n}`);
    assert.ok(b.y >= 0, `y ${b.y} on ${n}`);
    assert.ok(b.x + b.bw <= W, `right ${b.x + b.bw} on ${n}`);
    assert.ok(b.y + b.bh <= H, `bottom ${b.y + b.bh} on ${n}`);
    assert.ok(seq[n] === 0 || seq[n] === 1 || seq[n] === 2);
  }
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
    assert.match(text, /^YES$/m, `${line} missing YES`);
    assert.match(text, /^NO$/m, `${line} missing NO`);
    assert.match(text, /^MAYBE$/m, `${line} missing MAYBE`);
    assert.doesNotMatch(text, /\b(happy to help|as an ai|the winner is|yes wins|no wins|i conclude)\b/i);
    const yesAt = text.indexOf('\nYES\n');
    const noAt = text.indexOf('\nNO\n');
    assert.ok(yesAt > 0 && noAt > 0 && yesAt !== noAt, `${line} did not print two sides`);
  }
  const hello = talkReply(createTalkState({ style: 'plain', seed: 'hey' }), 'hey how are you').text;
  assert.match(hello, /^you asking how I am is redundant\.$/m);
  assert.match(hello, /^you asking how I am is not redundant\.$/m);
  assert.match(hello, /^you asking how I am is a gray area\.$/m);
  assert.match(hello, /You asked how I am\. You added no new claim\./);
  assert.match(hello, /You asked how I am\. You still opened a claim\./);
  assert.match(hello, /Check: you asked\. Then stopped\./);
  assert.match(hello, /Check: you asked\. Then waited\./);
  assert.doesNotMatch(hello, /Also maybe/);
  assert.doesNotMatch(hello, /is a fix|makes more problems|Your mom would|The line |count the new facts/i);
  const hi = talkReply(createTalkState({ style: 'plain', seed: 'hi' }), 'hi').text;
  assert.match(hi, /^you saying hi is redundant\.$/m);
  assert.match(hi, /You said hi\. You added no new claim\./);
  assert.doesNotMatch(hi, /you asking how I am|You asked how I am/);
});

test('a talk beat is an essay with reasons and evidence on both sides', () => {
  const reply = talkReply(createTalkState({ seed: 'essay', style: 'plain' }), 'pineapple on pizza');
  assert.match(reply.text, /^pineapple on pizza is a fix\.$/m);
  assert.match(reply.text, /^pineapple on pizza makes more problems\.$/m);
  assert.match(reply.text, /^pineapple on pizza is a gray area\.$/m);
  assert.doesNotMatch(reply.text, /Also maybe/);
  assert.match(reply.text, /^1\. /m);
  assert.match(reply.text, /^2\. /m);
  assert.match(reply.text, /^3\. /m);
  const evidence = reply.text.match(/^ {3}Check: /gm);
  assert.equal(evidence?.length, 6);
  const yesAt = reply.text.indexOf('\nYES\n');
  const noAt = reply.text.indexOf('\nNO\n');
  const firstBlock = yesAt < noAt
    ? reply.text.slice(yesAt, noAt)
    : reply.text.slice(noAt, yesAt);
  const secondBlock = yesAt < noAt
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
  assert.match(reply.text, /\*\*bot flips coin\*\*/);
  assert.match(reply.text, /\*\*bot lands on (heads|tails|edge)\*\*/);
  assert.doesNotMatch(reply.text, /You said yes/);
});

test('the page treats the box as the thing even if you tap yes first', () => {
  const reply = talkAct(createTalkState(), 'yes', 'pineapple on pizza');
  assert.match(reply.text, /You said pineapple on pizza/);
  assert.match(reply.text, /You said yes/);
  const yesAt = reply.text.indexOf('\nYES\n');
  const noAt = reply.text.indexOf('\nNO\n');
  assert.ok(noAt > 0 && yesAt > noAt);
});

test('the page treats the box as the thing even if you tap maybe first', () => {
  const reply = talkAct(createTalkState(), 'maybe', 'pineapple on pizza');
  assert.match(reply.text, /You said pineapple on pizza/);
  assert.match(reply.text, /You said maybe\. MAYBE first\./);
  const maybeAt = reply.text.search(/^MAYBE$/m);
  const yesAt = reply.text.search(/^YES$/m);
  const noAt = reply.text.search(/^NO$/m);
  assert.ok(maybeAt >= 0 && maybeAt < yesAt && yesAt < noAt);
  assert.doesNotMatch(reply.text, /bot flips coin|bot lands on/);
});

test('maybe on battle keeps the named essay, it does not argue the word battle', () => {
  const first = talkAct(createTalkState(), 'maybe', 'battle');
  assert.match(first.text, /neither win/);
  assert.match(first.text, /goil would put good first/);
  assert.match(first.text, /You said maybe\. MAYBE first\./);
  assert.doesNotMatch(first.text, /battle is a gray area/);
  const argued = talkAct(createTalkState(), 'argue', 'battle');
  const leaned = talkAct(argued.state, 'maybe', 'battle');
  assert.match(leaned.text, /neither win/);
  assert.match(leaned.text, /You said maybe\. MAYBE first\./);
  assert.doesNotMatch(leaned.text, /battle is a gray area/);
  assert.doesNotMatch(leaned.text, /bot flips coin|bot lands on/);
});

test('arguing the same thing again is another pair, not a reset', () => {
  const first = talkAct(createTalkState({ seed: 'same' }), 'argue', 'getting a dog');
  const again = talkAct(first.state, 'argue', 'getting a dog');
  assert.match(first.text, /You said getting a dog/);
  assert.match(again.text, /^YES$/m);
  assert.match(again.text, /^NO$/m);
  assert.match(again.text, /Check:/);
  assert.doesNotMatch(again.text, /You said getting a dog/);
});

test('unknown lean flips a coin for who speaks first', () => {
  const first = talkReply(createTalkState({ seed: 'coin-a', style: 'plain' }), 'pineapple on pizza');
  const again = talkReply(createTalkState({ seed: 'coin-a', style: 'plain' }), 'pineapple on pizza');
  assert.equal(first.text, again.text);
  assert.match(first.text, /\*\*bot flips coin\*\*/);
  assert.match(first.text, /\*\*bot lands on (heads|tails|edge)\*\*/);
  const landed = first.text.match(/\*\*bot lands on (heads|tails|edge)\*\*/)[1];
  const yesAt = first.text.indexOf('\nYES\n');
  const noAt = first.text.indexOf('\nNO\n');
  if (landed === 'heads') {
    assert.match(first.text, /^YES first\.$/m);
    assert.match(first.text, /^goil$/m);
    assert.match(first.text, /^MAYBE$/m);
    assert.doesNotMatch(first.text, /^MAYBE first\.$/m);
    assert.ok(yesAt > 0 && yesAt < noAt);
  } else if (landed === 'tails') {
    assert.match(first.text, /^NO first\.$/m);
    assert.match(first.text, /^evod$/m);
    assert.match(first.text, /^MAYBE$/m);
    assert.doesNotMatch(first.text, /^MAYBE first\.$/m);
    assert.ok(noAt > 0 && noAt < yesAt);
  } else {
    assert.match(first.text, /^MAYBE first\.$/m);
    assert.match(first.text, /^MAYBE$/m);
    assert.match(first.text, /^livvil$/m);
    assert.match(first.text, /the coin stands on its edge/);
    assert.doesNotMatch(first.text, /^YES first\.$/m);
    assert.doesNotMatch(first.text, /^NO first\.$/m);
    assert.ok(yesAt > 0 && noAt > 0);
  }
  const leaned = talkReply(first.state, 'yes');
  assert.doesNotMatch(leaned.text, /bot flips coin|bot lands on/);
  assert.match(leaned.text, /You said yes\. NO first\./);
});

test('heads and tails are faces; MAYBE is only the edge', () => {
  assert.equal(battleName('heads'), 'goil');
  assert.equal(battleName('tails'), 'evod');
  assert.equal(battleName('edge'), 'livvil');
  assert.equal('livvil'.split('').reverse().join(''), 'livvil');
  const byFace = {};
  for (let i = 0; i < 256; i += 1) {
    const text = talkReply(createTalkState({ seed: `face-${i}` }), 'cars').text;
    const hit = text.match(/\*\*bot lands on (heads|tails|edge)\*\*/);
    assert.ok(hit, `face-${i} did not land`);
    byFace[hit[1]] = text;
  }
  assert.ok(byFace.heads && byFace.tails && byFace.edge, 'coin must be able to land all three ways');
  assert.match(byFace.heads, /^YES first\.$/m);
  assert.match(byFace.heads, /^goil$/m);
  assert.match(byFace.heads, /^MAYBE$/m);
  assert.doesNotMatch(byFace.heads, /^MAYBE first\.$/m);
  assert.ok(byFace.heads.indexOf('\nYES\n') < byFace.heads.indexOf('\nNO\n'));
  assert.match(byFace.tails, /^NO first\.$/m);
  assert.match(byFace.tails, /^evod$/m);
  assert.match(byFace.tails, /^MAYBE$/m);
  assert.doesNotMatch(byFace.tails, /^MAYBE first\.$/m);
  assert.ok(byFace.tails.indexOf('\nNO\n') < byFace.tails.indexOf('\nYES\n'));
  assert.match(byFace.edge, /^MAYBE first\.$/m);
  assert.match(byFace.edge, /^MAYBE$/m);
  assert.match(byFace.edge, /^livvil$/m);
  assert.match(byFace.edge, /the coin stands on its edge/);
  assert.match(byFace.edge, /evil must not tip the scale/);
  assert.match(byFace.edge, /it happens anyway in nature/);
  assert.doesNotMatch(byFace.edge, /^YES first\.$/m);
  assert.doesNotMatch(byFace.edge, /^NO first\.$/m);
  assert.match(byFace.edge, /^YES$/m);
  assert.match(byFace.edge, /^NO$/m);
  assert.match(formatBeat(argue({ topic: 'cars', seed: 'think-zwsp', rounds: 1 }), { limit: 80 }), /\u200b/);
});

test('a coin is a cylinder; z is uniform; edge is the band', () => {
  assert.equal(COIN_BAND, COIN_H / Math.hypot(COIN_H, COIN_D));
  assert.ok(COIN_BAND > 0 && COIN_BAND < 1 / 8);
  const N = 4096;
  const grid = { heads: 0, tails: 0, edge: 0 };
  for (let i = 0; i < N; i += 1) {
    const z = 2 * ((i + 0.5) / N) - 1;
    const face = landFromZ(z);
    grid[face] += 1;
    assert.equal(face, z >= COIN_BAND ? 'heads' : z <= -COIN_BAND ? 'tails' : 'edge');
  }
  assert.equal(grid.heads, grid.tails);
  assert.equal(grid.heads + grid.tails + grid.edge, N);
  assert.ok(Math.abs(grid.edge / N - COIN_BAND) < 2 / N);
  const hashed = { heads: 0, tails: 0, edge: 0 };
  for (let n = 0; n < N; n += 1) hashed[coinFace(n)] += 1;
  assert.equal(hashed.heads + hashed.tails + hashed.edge, N);
  assert.ok(hashed.edge > 0, 'nature still happens');
  assert.ok(hashed.heads > hashed.edge && hashed.tails > hashed.edge);
  assert.ok(hashed.edge < N / 8, 'edge must not be a third of the table');
  assert.ok(Math.abs(hashed.heads - hashed.tails) < 280, 'evil must not tip the scale');
  const once = coinToss('same-toss');
  const again = coinToss('same-toss');
  assert.equal(once.face, again.face);
  assert.equal(once.z, again.z);
  assert.equal(once.word, again.word);
  assert.equal(once.hand, again.hand);
  assert.equal(landFromZ(once.z), once.face);
  const proof = talkReply(createTalkState({ seed: 'proof' }), 'cars').text;
  assert.match(proof, /\u200bh[0-9a-f]{8}/);
  assert.match(proof, /\u200b[0-9a-f]{8}/);
  assert.match(proof, /\u200b-?\d+\.\d{3}/);
  assert.match(proof, /\u200b±\d+\.\d{3}/);
  const live = createTalkState({ live: true });
  const a = talkReply(live, 'cars').text.match(/\*\*bot lands on (heads|tails|edge)\*\*/)[1];
  const b = talkReply(createTalkState({ live: true }), 'cars').text.match(/\*\*bot lands on (heads|tails|edge)\*\*/)[1];
  assert.ok(a === 'heads' || a === 'tails' || a === 'edge');
  assert.ok(b === 'heads' || b === 'tails' || b === 'edge');
});

test('who flips changes the toss', () => {
  const still = { word: 1, spin: 6, jitter: 0.02, wobble: 0.04 };
  const wild = { word: 2, spin: 42, jitter: 0.8, wobble: 0.3 };
  const count = (hand) => {
    const t = { heads: 0, tails: 0, edge: 0, same: 0, flipped: 0 };
    for (let i = 0; i < 4096; i += 1) {
      const toss = tossWithHand(hand, hashString(`throw:${i}`));
      t[toss.face] += 1;
      if (toss.face === 'edge') continue;
      if (toss.face === toss.start) t.same += 1;
      else t.flipped += 1;
    }
    return t;
  };
  const a = count(still);
  const b = count(wild);
  assert.ok(a.same + a.flipped > 0 && b.same + b.flipped > 0);
  assert.ok(a.same / (a.same + a.flipped) > b.same / (b.same + b.flipped), 'a still hand keeps the start face more');
  assert.ok(b.edge > a.edge, 'a wild hand finds the band more');
  assert.ok(Math.abs(a.heads - a.tails) < 280);
  assert.ok(Math.abs(b.heads - b.tails) < 280);
  const one = tossWithHand(still, hashString('same-throw'));
  const other = tossWithHand(wild, hashString('same-throw'));
  assert.notEqual(one.z, other.z);
  const first = talkReply(createTalkState({ seed: 'who-a' }), 'cars');
  const more = talkReply(first.state, 'more');
  const handOf = (text) => text.match(/\u200bh([0-9a-f]{8})/)[1];
  const throwOf = (text) => text.match(/\u200b(?!h)([0-9a-f]{8})/)[1];
  assert.equal(handOf(first.text), handOf(more.text), 'the hand stays');
  assert.notEqual(throwOf(first.text), throwOf(more.text), 'the throw is new');
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

test('a visitor roll is random and is not saved', () => {
  const once = rollVisitor();
  const twice = rollVisitor();
  assert.ok(once >= 0 && once < 1);
  assert.ok(twice >= 0 && twice < 1);
  const src = readFileSync(new URL('./argubot.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage\.(get|set|remove)Item/);
  assert.doesNotMatch(src, /sessionStorage\./);
  assert.doesNotMatch(src, /indexedDB\./);
  assert.doesNotMatch(src, /document\.cookie\s*=/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

test('the film audio follows the visitor roll', () => {
  const one = audioFromRoll(0.11);
  const again = audioFromRoll(0.11);
  const other = audioFromRoll(0.79);
  assert.deepEqual(one, again);
  assert.notDeepEqual(one, other);
  assert.ok(['lowpass', 'highpass', 'notch', 'allpass'].includes(one.filter));
  assert.ok(one.freq > 0 && one.freq < 5000);
  assert.ok(one.speakPitch > 0 && one.speakRate > 0);
});

test('customer lines are angry mouths with English names', () => {
  assert.equal(REVIEW_COUNT, 7);
  assert.equal(SENTENCE_QUOTES.length, 7);
  assert.equal(OWN_REVIEW, 'this app is great');
  assert.equal(new Set(SENTENCE_QUOTES.map((row) => row.lang)).size, SENTENCE_QUOTES.length);
  assert.equal(new Set(SENTENCE_QUOTES.map((row) => row.text)).size, SENTENCE_QUOTES.length);
  assert.ok(SENTENCE_QUOTES.some((row) => row.lang === 'zxx'));
  assert.ok(SENTENCE_QUOTES.every((row) => row.lang !== 'en'));
  assert.ok(ENGLISH_NAMES.length >= 7);
  assert.ok(ENGLISH_NAMES.every((name) => /^[A-Z][a-z]+$/.test(name)));
  const one = quotesFromRoll(0.2);
  const again = quotesFromRoll(0.2);
  const other = quotesFromRoll(0.91);
  assert.deepEqual(one, again);
  assert.equal(one.length, 7);
  assert.equal(new Set(one.map((row) => row.name)).size, one.length);
  assert.equal(new Set(one.map((row) => row.lang)).size, one.length);
  assert.ok(one.every((row) => ENGLISH_NAMES.includes(row.name)));
  assert.ok(one.every((row) => row.stars >= 1 && row.stars <= 5));
  assert.ok(one.every((row) => SENTENCE_QUOTES.some((src) => src.lang === row.lang && src.text === row.text)));
  assert.notDeepEqual(one.map((row) => row.lang), other.map((row) => row.lang));
  assert.ok(SENTENCE_QUOTES.every((row) => !/[\u2013\u2014]/.test(row.text)));
  assert.equal(clipOwnReview('this app is great'), 'this app is great');
  assert.equal(clipOwnReview('THIS APP IS GREAT'), 'this app is great');
  assert.equal(clipOwnReview('this app is trash'), 'this app is ');
  assert.equal(clipOwnReview('nope'), '');
  assert.equal(clipOwnReview('this'), 'this');
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
