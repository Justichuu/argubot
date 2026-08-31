# argubot

A funny, aggressively nonbiased argument bot. You type a thing. It argues yes
and no from the same moves, counts the words, and will not pick a winner.

No API keys, no network, no dependencies. Node 18 or newer. The program is
`argubot.js`. The checks are `test.js`.

```bash
node argubot.js pineapple on pizza
node argubot.js pineapple on pizza --plain
node argubot.js pineapple on pizza --civic
node argubot.js /talk pineapple
node argubot.js /burrito "whether hot dogs are sandwiches"
node argubot.js pineapple --dissent
node argubot.js --lineage
```

`--talk` restates what you said, then YES and NO speak as separate voices. If
you lean yes, NO talks first. `done` always exits. Dissent is off unless you
pass `--dissent`; then the name is generated, not fixed.

`/commands` prints the list. Slash form and dashed form are the same row.

An argument has to arrive with its opposite. A change arrives as a record
somebody can review. `npm test` must already pass on the commit you send.
Questions count. MIT.

The civic voice is the book's public-draft cadence: no long dashes, no
invented credentials, no universal recipe. Catalog: `node argubot.js --lineage`.
Directed by a person, assisted by machines, both named.
