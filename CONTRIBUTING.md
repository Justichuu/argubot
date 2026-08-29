# Contributing

Contributions are welcome and entirely optional. There is no roadmap to keep up
with, no response-time promise, and nothing here is urgent. If you open a pull
request and then change your mind, close it. That is a complete and acceptable
outcome.

## The one rule that matters

Every argument in this bot exists as a matched pair. A template that argues for
something must ship the version that argues against it, built from the same
rhetorical move. That is the whole design: the bot cannot take a side because it
has no unpaired ammunition.

A pull request that adds a one-sided argument will be asked to add the twin, not
rejected.

## Adding a rhetorical pair

Open `src/rhetoric.js` for the classic voice, `src/plain.js` for the plain one,
or `src/civic.js` for the book voice, then add an entry:

```js
{
  id: 'weather',
  move: 'appeal to the weather',
  for: (c) => `${capitalize(c)} is fine in the rain, and it rains eventually.`,
  against: (c) => `${capitalize(c)} is untested in the rain, and it rains eventually.`,
}
```

Run `npm test`. The suite checks that both sides exist, that they differ, that
they end in punctuation, that ids are unique, and that the word counts stay
balanced within tolerance for every sample topic. For the plain style it also
checks that you used no jargon and no word longer than ten letters.

Funny is good. Cruel is not. Nothing in this repository should be funny at the
expense of a real person, a group, or a private situation.

Civic pairs have two extra rules, both from the book: no en-dash or em-dash,
and no invented credential, study, or official approval. Agency is the subject.
A universal recipe is the joke.

## Other useful work

- New styles alongside `classic`, `plain`, and `civic`, registered in `src/styles.js`
- A lineage entry in `src/lineage.js` and `LINEAGE.md` when you borrow a checkable idea
- Terminal rendering: narrow widths, right-to-left text, screen readers
- Accuracy of the fairness audit, including metrics beyond word count
- Documentation, typos, and clearer error messages
- Talk-mode asides, hear-backs, and lean handling, as long as both sides still speak
- Slash commands and flags should stay paired: a `/command` that has no dashed form is incomplete

## Every change arrives as a record somebody can review

The `main` branch refuses direct pushes, for the maintainer as much as for
anybody else. A pull request is the record of what changed and why, and a push
that skips it destroys the record it was supposed to leave behind.

A pull request is the usual way to send that record here, and it is not the only
one. If pull requests are not how you work, for any reason at all, open an issue
saying so and another route gets arranged. What is required is the reviewable
record, never a particular tool, and asking costs you nothing.

Every commit you send should already pass `npm test`. Not just the branch as a
whole, and not just after review. A commit that was never green is not evidence
that the work works, and a reviewer reading the history later cannot tell the
difference.

Keep commits separable, so one piece can be dropped without unpicking the rest.

## Practical notes

- Node 18 or newer. No dependencies, and pull requests that add one need a
  reason in the description.
- `npm test` must pass. It runs the suite and `scripts/validate.js`. CI runs
  both on Node 18, 20, and 22, on Linux, Windows, and macOS.
- Match the surrounding style. Comments explain constraints, not narration.
- Small pull requests get read sooner than large ones, though neither is fast.

## What contributing does not create

Opening a pull request does not create an obligation on either side. It is not
employment, not a promise of merge or payment, and not a claim on the project.
You keep the copyright in what you write; by opening the pull request you offer
it under the repository's MIT license.

If you would rather ask a question than write code, open an issue. Questions are
a real contribution and cost less than a wasted afternoon.
