# Lineage

argubot is the runnable footnote to a chapter in
[The Pursuit of Happiness over Hubris](https://github.com/Justichuu/pursuit-of-happiness-not-hubris).
This file is the named catalog of ideas it borrowed from every public
Justichuu repository, in the spirit of
[asa-list](https://github.com/Justichuu/asa-list): each entry has an id you
can check, a source you can open, and a claim small enough to verify.

The machine-readable copy lives in `src/lineage.js`. `npm run validate`
refuses a catalog that forgets a repo or cites one that is not Justichuu's.

```
node bin/argubot.js --lineage
```

## Justichuu repositories

| id | repository | what was read |
| --- | --- | --- |
| `argubot` | [Justichuu/argubot](https://github.com/Justichuu/argubot) | mirrored pairs, fairness by construction, Gary, no verdict |
| `book` | [Justichuu/pursuit-of-happiness-not-hubris](https://github.com/Justichuu/pursuit-of-happiness-not-hubris) | civic voice, no long dashes, no invented credentials, validator that names rules |
| `directory` | [Justichuu/private-directory-server](https://github.com/Justichuu/private-directory-server) | evidence over claims, honest human and AI authorship, local-first, no telemetry |
| `asa-list` | [Justichuu/asa-list](https://github.com/Justichuu/asa-list) | a named public catalog plus a proof step before merge (Tinyman fork) |

asa-list is a fork. The borrowed idea is the catalog shape, not a claim that
Justichuu invented Algorand asset lists.

## Named ideas

| id | idea | from |
| --- | --- | --- |
| `mirrored-pairs` | Every argument ships as a matched for-and-against pair | argubot |
| `fairness-by-construction` | Neutrality is structural: the bot has no unpaired ammunition | argubot |
| `no-verdict` | The program is not allowed to pick a winner | argubot |
| `civic-voice` | A third style speaks in the book's public-draft cadence | book |
| `no-long-dash` | Civic voice and the validator refuse en-dashes and em-dashes | book |
| `no-invented-credentials` | Civic lines may not invent degrees, studies, or official approval | book |
| `evidence-over-claims` | A fluent sentence is not evidence. Word counts and tests are | directory |
| `honest-authorship` | Human direction and AI assistance are both named | directory |
| `local-first` | No network, no API keys, no telemetry | directory |
| `named-catalog` | Borrowed ideas are listed with ids and sources you can check | asa-list |
| `validator-reports-rules` | The validator names the failed rule, never the suspected secret | book |
| `reviewable-record` | A contribution is a record somebody can review, not a particular tool | argubot ([PR 6](https://github.com/Justichuu/argubot/pull/6)) |

## What this catalog is not

It is not a list of credentials, sales, or approvals. Public code is not
proof that every claim in the book is true. That argument belongs in the
book.
