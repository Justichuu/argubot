# argubot

A funny, aggressively nonbiased argument bot. Give it any topic and it argues both sides
with equal force, audits itself for bias, and then refuses to reach a conclusion.

No API keys, no network calls, no dependencies. Requires Node 18 or newer.

## Usage

```bash
node bin/argubot.js pineapple on pizza
node bin/argubot.js "whether hot dogs are sandwiches" --rounds 5
node bin/argubot.js standing desks --seed monday --json
```

```
Options:
  -r, --rounds <n>       arguments per side (1-16, default 3)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
      --no-gary          hold the debate without Gary
      --json             print the debate as JSON
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version
```

Run `npm test` for the test suite.

## How the neutrality actually works

Most "unbiased" generators are unbiased by promise. This one is unbiased by construction,
in three ways:

1. **Mirrored templates.** Every rhetorical move in `src/rhetoric.js` ships as a matched
   pair, so no argument can exist without its evil twin. The FOR and AGAINST sides are
   always built from the identical set of moves in the identical order.
2. **A real bias audit.** `src/audit.js` measures word count, hedges, intensifiers,
   questions, and exclamations on each side and reports the gap. If the sides drift apart
   by more than `--tolerance` words, the lighter side gets padded with neutral filler
   (`, allegedly`, `, citation pending`) until the counts match. At `--tolerance 0` the two
   sides come out to exactly the same word count.
3. **No verdict.** The bot is structurally incapable of picking a winner, and a test
   asserts it never does.

Same topic plus same seed always yields the same debate: the generator is a seeded
mulberry32 PRNG fed by an FNV-1a hash of the claim, so nothing depends on wall-clock time.

## Gary

Gary is an independent participant who says `No.` He says it about every topic, from every
angle, before the topic is announced. He is included by default because a debate with two
symmetric sides and no dissent is suspicious. Pass `--no-gary` to hold the debate without
him; the rest of the output is unchanged, which is exactly the sort of thing Gary would
say no to.

## Layout

```
bin/argubot.js          CLI: argument parsing, help, exit codes
src/argubot.js          debate assembly and claim normalization
src/rhetoric.js         mirrored FOR/AGAINST template families, Gary, filler
src/audit.js            bias measurement and word-count balancing
src/rng.js              seeded PRNG and deterministic picks
src/render.js           terminal output, wrapping, optional color
test/argubot.test.js    23 tests over the library, renderer, and CLI
```
