# argubot

A funny, aggressively nonbiased argument bot. Give it any topic and it argues both sides
with equal force, checks its own fairness, and then refuses to pick a winner.

No API keys, no network calls, no dependencies. Needs Node 18 or newer.

## In plain words

You type a thing. The bot gives you reasons to say yes and the exact same number of
reasons to say no. Then it counts the words on both sides to make sure it was not being
sneaky, and it tells you it will not be choosing. A third voice that only says no is
optional and off by default. When you turn it on, it gets a generated name, not a
fixed one.

It is not smart and it is not connected to anything. It is a box of jokes that were
written to come in pairs, so it cannot take a side even if it wants to.

## Try it

```bash
node bin/argubot.js pineapple on pizza
node bin/argubot.js pineapple on pizza --plain
node bin/argubot.js pineapple on pizza --civic
node bin/argubot.js "whether hot dogs are sandwiches" --rounds 5
node bin/argubot.js getting a dog --plain --tolerance 0
echo "whether this commit needed an argument" | node bin/argubot.js --civic
node bin/argubot.js /talk pineapple on pizza
node bin/argubot.js /burrito --plain "whether hot dogs are sandwiches"
node bin/argubot.js /commands
node bin/argubot.js pineapple --dissent
node bin/argubot.js --lineage
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

  FAIRNESS CHECK
    50 words for yes, 50 words for no · off by 0 (allowed 0) · EVEN

  SO WHO WINS: One point to this side, one point to that side, one point to the couch.
```

## Two ways to talk

| Style | What it sounds like |
| --- | --- |
| `classic` (default) | debate club: invented statistics, appeals to your ancestors, named fallacies |
| `plain` (`--plain`) | common language: short words, your mom, five minutes, cleaning it up later |
| `civic` (`--civic`) | the book's public-draft voice: agency, evidence, no recipe, no long dashes |

All three styles are built the same way and are held to the same fairness rules. The plain
style has tests asserting it never uses jargon and never uses a word longer than ten
letters. The civic style has tests asserting it never uses a long dash and never invents
a credential. It is the runnable cousin of a chapter in
[The Pursuit of Happiness over Hubris](https://github.com/Justichuu/pursuit-of-happiness-not-hubris).

## Options

```
  -r, --rounds <n>       arguments per side (default 3; max is the style's pair count)
  -s, --seed <value>     mix a value into the seed for a different debate
  -t, --tolerance <n>    allowed word-count gap between sides (default 2)
      --style <name>     classic | plain | civic (default classic)
  -p, --plain            shorthand for --style plain
      --civic            shorthand for --style civic
  -i, --talk             same as /talk
      --burrito          same as /burrito: every voice on one plate
  -d, --dissent          optional third voice that only says no (off by default)
      --name <word>      turn dissent on and choose the name
      --json             print the debate as JSON
      --lineage          print the named catalog of borrowed ideas
      --no-color         disable ANSI color
  -h, --help             show this help
  -v, --version          show version
```

If you give no topic and stdin is a pipe, the bot reads the topic from stdin.
A topic on the command line always wins.

## Talking

`--talk` is a conversation, not a dump. You say a thing. The bot restates it,
then YES and NO speak as separate voices. If you lean yes, NO talks first. If
you lean no, YES talks first. The bot will not continue in the direction you
were already going. You keep a turn the bot cannot fill. Slash commands work
inside the conversation: `/style civic`, `/dissent on`, `/burrito`, `/done`.

Type `more` for another pair, `yes` or `no` to lean, or `/done` to leave.
`done` always works. There is no loop that only sends you back to the same prompt.

```
Say a thing. I will argue both sides and I will not pick.
Type done when you want out. That always works.
> pineapple on pizza
Okay. You said pineapple on pizza.

YES
  ...

NO
  ...

GARY
  No.

Same move, other direction. That is on purpose.
more · new topic · done
```

## JSON shape

`--json` prints the debate as one object. Fields:

| Field | Meaning |
| --- | --- |
| `claim` | normalized topic the templates actually received |
| `style` | `classic`, `plain`, or `civic` |
| `seed` | unsigned 32-bit seed derived from the claim |
| `rounds` | arguments per side after clamping |
| `moves` | rhetorical move names, same order on both sides |
| `for` | array of for-side sentences |
| `against` | array of against-side sentences |
| `dissent` | `null` by default; `{ name, statement, footnote }` when `--dissent` is on |
| `moderator` | one moderator line |
| `verdict` | one refusal to pick a winner |
| `audit` | per-side word, hedge, intensifier, question, and exclamation counts, plus `wordDelta`, `tolerance`, `balanced`, and `heavierSide` |

Same topic, style, and seed always produce the same object.

## How the fairness actually works

Most "unbiased" generators are unbiased by promise. This one is unbiased by construction,
in three ways:

1. **Mirrored templates.** Every rhetorical move in `src/rhetoric.js`, `src/plain.js`,
   and `src/civic.js` ships as a matched pair, so no argument can exist without its evil
   twin. The two sides are always built from the identical moves in the identical order.
2. **A real fairness check.** `src/audit.js` measures word count, hedges, intensifiers,
   questions, and exclamations on each side and reports the gap. If the sides drift apart
   by more than `--tolerance` words, the lighter side gets padded with neutral filler
   (`, allegedly`, `, probably`) until the counts match. At `--tolerance 0` both sides come
   out to exactly the same word count.
3. **No verdict.** The bot is structurally incapable of picking a winner, and a test
   asserts that it never does.

Same topic plus same seed always gives the same debate: the generator is a seeded
mulberry32 PRNG fed by an FNV-1a hash of the claim, so nothing depends on the clock.

## Where this idea comes from

This tool is the runnable footnote to a chapter in
[The Pursuit of Happiness over Hubris](https://github.com/Justichuu/pursuit-of-happiness-not-hubris),
a living open book by Justichuu. The book's ego chapter argues that a machine is
a flattering mirror: the risk in thinking alongside one is not that it lies to you, but
that it agrees with you beautifully, and fluency reads like confirmation when it is only
a style.

So this bot cannot agree with you. It is not even handed because a readme promised it
would be. It is even handed because every argument it owns exists as a matched pair, and
it counts the words on both sides afterward to show it did not lean. Fairness kept in a
promise is a mood. Fairness kept in the structure outlives the author's week.

Running code demonstrates that a rule can be enforced. It does not prove the rule is
right. That argument belongs in the book.

The civic style is the book's voice made runnable: no long dashes, no invented
credentials, no universal recipe. `scripts/validate.js` is the book's
`validate.py` idea in this repo. It names the failed rule and never prints a
suspected secret. The named catalog of every borrowed idea, including work from
[Private Directory Server](https://github.com/Justichuu/private-directory-server)
and the catalog shape of [asa-list](https://github.com/Justichuu/asa-list), is
in [LINEAGE.md](LINEAGE.md).

## Dissent

A third voice that only says `No.` is optional and **off by default**. When it is
off, it has no name and does not appear. When you pass `--dissent` or `/dissent`,
a name is generated from consonant-plus-vowel-sound pairs (so you get something
like `Kalo` or `Vuri`, not a fixed person). `--name` sets the word yourself.
Same topic and seed always produce the same generated name.

## Commands

Every feature is a `/command` and a flag. `argubot /commands` prints the list.
`/burrito` serves every voice on one topic with a ledger. `/talk` is the
conversation. `/validate` runs the structural checks. `/ready` prints
`{"status":"ready"}`. `/menu` is a numbered picker.

## Layout

```
bin/argubot.js          CLI: /commands, flags, talk, burrito, menu
src/argubot.js          debate assembly and claim normalization
src/commands.js         slash and dashed command parsing
src/burrito.js          all styles on one plate
src/names.js            generated dissent names
src/talk.js             turn-taking: hear-back, named voices, slash commands
src/styles.js           style registry: classic, plain, and civic
src/rhetoric.js         classic mirrored FOR/AGAINST families, filler
src/plain.js            common-language families and labels
src/civic.js            book-voice families: agency, evidence, no recipe
src/lineage.js          named catalog of borrowed Justichuu ideas
src/audit.js            fairness measurement and word-count balancing
src/rng.js              seeded PRNG and deterministic picks
src/render.js           terminal output, wrapping, optional color
test/argubot.test.js    fairness, renderer, CLI, lineage, and civic rules
scripts/validate.js     structural checks; reports the rule, not the secret
scripts/publish.sh      create the GitHub repo and push
LINEAGE.md              human-readable copy of the catalog
ACKNOWLEDGMENTS.md      who directed the work and who assisted
```

## Development

```bash
npm test
npm run validate
```

## Contributing

Optional, unhurried, and welcome. The short version: an argument has to arrive
with its opposite, because the bot's neutrality is structural rather than
promised. Adding a mirrored pair to `src/rhetoric.js`, `src/plain.js`, or
`src/civic.js` is about five lines and the test suite checks the rest.

Questions count as contributions. See [CONTRIBUTING.md](CONTRIBUTING.md), or the
issues labeled `good first issue`.

## License

MIT
