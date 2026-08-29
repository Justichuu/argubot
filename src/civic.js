// The book's public-draft voice: agency against hubris, evidence against
// invented credentials, a joke that reveals rather than exposes. Still
// mirrored pair by pair. Long dashes are refused; that rule is from the book.

const capitalize = (text) => (text.length === 0 ? text : text[0].toUpperCase() + text.slice(1));

export const CIVIC_FAMILIES = [
  {
    id: 'recipe',
    move: 'universal recipe',
    for: (c) =>
      `${capitalize(c)} can be your path without becoming everybody's homework, and that is the useful kind of success.`,
    against: (c) =>
      `${capitalize(c)} becomes everybody's homework the moment you sell it as a path, and that is the usual kind of hubris.`,
  },
  {
    id: 'agency',
    move: 'range of choices',
    for: (c) => `Doing ${c} gives you more ways to choose later, and more ways to choose is the actual prize.`,
    against: (c) => `Doing ${c} takes away ways to choose later, and fewer ways to choose is the actual cost.`,
  },
  {
    id: 'leverage',
    move: 'tool leverage',
    for: (c) => `Used as a tool, ${c} returns leverage to you and leaves you more able than it found you.`,
    against: (c) => `Used as a boss, ${c} consumes the person doing it and leaves you less able than it found you.`,
  },
  {
    id: 'scoped',
    move: 'scoped authority',
    for: (c) => `Authority over ${c} can stay small, reviewable, and replaceable, which is how a free person keeps a tool.`,
    against: (c) => `Authority over ${c} can grow into an unlimited key, which is how a free person loses a tool.`,
  },
  {
    id: 'evidence',
    move: 'evidence over claims',
    for: (c) => `The case for ${c} can be checked, and a claim you can check is worth more than a fluent one.`,
    against: (c) => `The case for ${c} is still only a claim, and a fluent claim is not evidence that it is true.`,
  },
  {
    id: 'time',
    move: 'time is not money',
    for: (c) => `Time spent on ${c} can buy a later choice, which is the only honest way time behaves like money.`,
    against: (c) => `Time spent on ${c} can turn you into inventory, which is what happens when every minute is a price.`,
  },
  {
    id: 'joke',
    move: 'joke that reveals',
    for: (c) => `The funny thing about ${c} is that it shows a real idea, and that is the kind of joke worth keeping.`,
    against: (c) => `The funny thing about ${c} is that it can expose a person, and that is the kind of joke worth dropping.`,
  },
  {
    id: 'gate',
    move: 'human selects',
    for: (c) => `A human can still choose ${c} on purpose, and a chosen line is different from a dumped one.`,
    against: (c) => `A machine can dump ${c} without choosing, and a dumped line is different from a chosen one.`,
  },
  {
    id: 'continuity',
    move: 'carry work forward',
    for: (c) => `Keeping ${c} going can protect the work without requiring permanent control over the next person.`,
    against: (c) => `Keeping ${c} going can turn into permanent control, and the next person then inherits a lock.`,
  },
  {
    id: 'happiness',
    move: 'happiness is work',
    for: (c) => `${capitalize(c)} can be part of becoming able to choose and recover, which is a pursuit and not a prize.`,
    against: (c) => `${capitalize(c)} can be sold as a prize that guarantees happiness, which is a contest and not a life.`,
  },
  {
    id: 'luck',
    move: 'less dependent on luck',
    for: (c) => `${capitalize(c)} can make agency less dependent on luck, status, or permission, and that is the fair use.`,
    against: (c) => `${capitalize(c)} can make agency more dependent on luck, status, or permission, and that is the trap.`,
  },
  {
    id: 'worship',
    move: 'work without worship',
    for: (c) => `You can do ${c} without worshipping the work, and then the work still has to earn its keep.`,
    against: (c) => `You can turn ${c} into who you are, and then the work no longer has to earn its keep.`,
  },
  {
    id: 'boundary',
    move: 'public draft, not a whole life',
    for: (c) => `${capitalize(c)} can stay a public draft: selected, attributed, and inspectable after the fact.`,
    against: (c) => `${capitalize(c)} can swallow a whole life, and a person's whole life is not a public draft.`,
  },
  {
    id: 'recovery',
    move: 'room to recover',
    for: (c) => `A fair take on ${c} leaves room to recover from a mistake, because a useful path expects mistakes.`,
    against: (c) => `An unfair take on ${c} leaves no room to recover, because a sold path pretends mistakes are rare.`,
  },
];

export const CIVIC_MODERATOR_LINES = [
  'Both sides here are the same bot. That is the point, not a confession.',
  'The record is public. A person\'s whole life is not.',
  'The moderator will not invent a credential to make this sound official.',
  'A fluent sentence is not evidence. The word count is.',
  'The moderator reminds the room that one life is not a universal map.',
];

export const CIVIC_VERDICT_LINES = [
  'The bot will not sell you a map. You already have a life.',
  'One point to each side. Zero points to hubris.',
  'The bot declines to turn a pursuit into a contest with a winner.',
  'The bot has no recipe that begins with first, become the bot.',
  'The bot keeps the decision. The bot is not the person who has to live it.',
];

export const CIVIC_GARY_FOOTNOTES = [
  'Gary is not a recipe. Gary is a no.',
  'Gary declined the map and kept the weather.',
  'Gary was asked for a universal method. See above.',
  'Gary has held this no since before success was a product.',
  'Gary is here so the room has dissent that is not a style.',
];

export const CIVIC_FLOURISHES = [
  ' still',
  ', too',
  ', maybe',
  ', for now',
  ', as a claim',
  ', pending review',
  ', on the evidence',
  ', in this draft',
  ', without a recipe',
];

export const CIVIC_LABELS = {
  question: (claim) => `A QUESTION OF ${claim.toUpperCase()}`,
  meta: (seed, rounds) =>
    `seed ${seed} · ${rounds} reason(s) each · both sides built as twins · no recipe sold`,
  for: 'THE CASE FOR',
  against: 'THE CASE AGAINST',
  gary: 'GARY (not a recipe)',
  audit: 'EVIDENCE CHECK',
  auditSummary: (audit, status) =>
    `${audit.for.words} words for, ${audit.against.words} words against · ` +
    `gap ${audit.wordDelta} (allowed ${audit.tolerance}) · ${status}`,
  auditDetail: (audit) =>
    `hedges ${audit.for.hedges} to ${audit.against.hedges} · ` +
    `intensifiers ${audit.for.intensifiers} to ${audit.against.intensifiers} · ` +
    'every line on one side has a twin on the other',
  balanced: 'EVEN HANDED',
  imbalanced: 'LEANING',
  verdict: 'WHO DECIDES:',
};
