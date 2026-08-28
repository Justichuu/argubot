# argubot

A funny, aggressively nonbiased argument bot. Give it any topic and it argues both sides
with equal force, checks its own fairness, and then refuses to pick a winner.

No API keys, no network calls, no dependencies. Needs Node 18 or newer.

## In plain words

You type a thing. The bot gives you reasons to say yes and the exact same number of
reasons to say no. Then it counts the words on both sides to make sure it was not being
sneaky, and it tells you it will not be choosing. There is also a guy named Gary who only
says no.

It is not smart and it is not connected to anything. It is a box of jokes that were
written to come in pairs, so it cannot take a side even if it wants to.

## Try it

```bash
node bin/argubot.js pineapple on pizza
node bin/argubot.js pineapple on pizza --plain
node bin/argubot.js "whether hot dogs are sandwiches" --rounds 5
node bin/argubot.js getting a dog --plain --tolerance 0
```

```
  ARGUING ABOUT GETTING A DOG

  WHY YES
     1. Doing nothing about getting a dog is also a choice, and it is the boring one.
     2. Getting a dog feels right, and a gut feeling is usually a pretty good guide.

  WHY NO
     1. Doing something about getting a dog is also a choice, and it is the loud one.
     2. Getting a dog feels right, and that is usually when people get themselves in
        trouble.

  GARY (his own thing)
    No.

  FAIRNESS CHECK
    50 words for yes, 50 words for no · off by 0 (allowed 0) · EVEN

  SO WHO WINS: One point to this side, one point to that side, one point to the couch.
```

## Two ways to talk

| Style | What it sounds like |
| --- | --- |
| `classic` (default) | debate club: invented statistics, appeals to your ancestors, named fallacies |
| `plain` (`--plain`) | common language: short words, your mom, five minutes, cleaning it up later |

Both styles are built the same way and are held to the same fairness rules. The plain
style has tests asserting it never uses jargon and never uses a word longer than ten
letters.

## Options

```
  -r, --rounds <n>       arguments per side (default 3, max 16 classic / 14 plain)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
      --style <name>     classic | plain (default classic)
  -p, --plain            shorthand for --style plain
      --no-gary          hold the debate without Gary
      --json             print the debate as JSON
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version
```

## How the fairness actually works

Most "unbiased" generators are unbiased by promise. This one is unbiased by construction,
in three ways:

1. **Mirrored templates.** Every rhetorical move in `src/rhetoric.js` and `src/plain.js`
   ships as a matched pair, so no argument can exist without its evil twin. The two sides
   are always built from the identical moves in the identical order.
2. **A real fairness check.** `src/audit.js` measures word count, hedges, intensifiers,
   questions, and exclamations on each side and reports the gap. If the sides drift apart
   by more than `--tolerance` words, the lighter side gets padded with neutral filler
   (`, allegedly`, `, probably`) until the counts match. At `--tolerance 0` both sides come
   out to exactly the same word count.
3. **No verdict.** The bot is structurally incapable of picking a winner, and a test
   asserts that it never does.

Same topic plus same seed always gives the same debate: the generator is a seeded
mulberry32 PRNG fed by an FNV-1a hash of the claim, so nothing depends on the clock.

## Gary

Gary is an independent participant who says `No.` He says it about every topic, from every
angle, before the topic has been announced. He is included by default because a debate
with two perfectly symmetric sides and no dissent is suspicious. Pass `--no-gary` to hold
the debate without him; nothing else in the output changes, which is exactly the sort of
thing Gary would say no to.

## Layout

```
bin/argubot.js          CLI: argument parsing, help, exit codes
src/argubot.js          debate assembly and claim normalization
src/styles.js           style registry: classic and plain
src/rhetoric.js         classic mirrored FOR/AGAINST families, Gary, filler
src/plain.js            common-language families and labels
src/audit.js            fairness measurement and word-count balancing
src/rng.js              seeded PRNG and deterministic picks
src/render.js           terminal output, wrapping, optional color
test/argubot.test.js    40 tests over both styles, the renderer, and the CLI
scripts/publish.sh      create the GitHub repo and push
```

## Development

```bash
npm test
```

## License

MIT
