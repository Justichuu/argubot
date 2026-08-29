// The same bot, in common language: short words, everyday reasons, no rhetoric
// jargon. Still mirrored pair by pair, because that is where the fairness lives.

const capitalize = (text) => (text.length === 0 ? text : text[0].toUpperCase() + text.slice(1));

export const PLAIN_FAMILIES = [
  {
    id: 'tried-it',
    move: 'I tried it once',
    for: (c) => `I did ${c} one time and my whole day got a little bit better after that.`,
    against: (c) => `I did ${c} one time and my whole day got a little bit worse after that.`,
  },
  {
    id: 'money',
    move: 'money',
    for: (c) => `${capitalize(c)} would save you money, as long as you do not think about it too hard.`,
    against: (c) => `${capitalize(c)} would cost you money, as soon as you start thinking about it at all.`,
  },
  {
    id: 'friends',
    move: 'what your friends would do',
    for: (c) => `Your friends would think ${c} is funny and then they would all want to try it too.`,
    against: (c) => `Your friends would think ${c} is funny and then they would tell other people about it.`,
  },
  {
    id: 'mom',
    move: 'what your mom would say',
    for: (c) => `Your mom would be fine with ${c} once somebody sat down and explained it to her slowly.`,
    against: (c) => `Your mom would have questions about ${c} and not one of those questions would be easy.`,
  },
  {
    id: 'five-minutes',
    move: 'how long it takes',
    for: (c) => `${capitalize(c)} takes five minutes, and you already waste more than that every single morning.`,
    against: (c) => `${capitalize(c)} takes five minutes, and then it takes five more minutes, every day, forever.`,
  },
  {
    id: 'everyone',
    move: 'everybody does it',
    for: (c) => `Plenty of people already do ${c} and honestly most of them seem to be doing fine.`,
    against: (c) => `Plenty of people already do ${c} and we have all quietly stopped asking them why.`,
  },
  {
    id: 'common-sense',
    move: 'common sense',
    for: (c) => `${capitalize(c)} is just common sense, and common sense is the good kind of sense.`,
    against: (c) => `${capitalize(c)} is only common sense, and common sense is wrong about half the time.`,
  },
  {
    id: 'next-year',
    move: 'next year',
    for: (c) => `In a year nobody is going to care that you did ${c}, so you might as well.`,
    against: (c) => `In a year somebody is going to bring up ${c} at dinner, so you might not.`,
  },
  {
    id: 'rules',
    move: 'the rules',
    for: (c) => `There is no rule against ${c}, and no rule against something is basically permission.`,
    against: (c) => `There is no rule about ${c} yet, and no rule about something is basically a warning.`,
  },
  {
    id: 'feelings',
    move: 'gut feeling',
    for: (c) => `${capitalize(c)} feels right, and a gut feeling is usually a pretty good guide.`,
    against: (c) => `${capitalize(c)} feels right, and that is usually when people get themselves in trouble.`,
  },
  {
    id: 'doing-nothing',
    move: 'doing nothing',
    for: (c) => `Doing nothing about ${c} is also a choice, and it is the boring one.`,
    against: (c) => `Doing something about ${c} is also a choice, and it is the loud one.`,
  },
  {
    id: 'kids',
    move: 'what a kid thinks',
    for: (c) => `A kid would love ${c}, and kids are honest about what is actually fun.`,
    against: (c) => `A kid would love ${c}, and kids are also honest about what is now broken.`,
  },
  {
    id: 'cleanup',
    move: 'cleaning up after',
    for: (c) => `If ${c} goes wrong you can clean the whole thing up in one afternoon.`,
    against: (c) => `If ${c} goes wrong you will be cleaning the whole thing up all week.`,
  },
  {
    id: 'story',
    move: 'the story later',
    for: (c) => `You could tell people about ${c} later and they would laugh in the good way.`,
    against: (c) => `You could tell people about ${c} later and they would get very quiet instead.`,
  },
  {
    id: 'sleep',
    move: 'sleep',
    for: (c) => `You will still sleep after ${c}, and that is the bar for a lot of choices.`,
    against: (c) => `You will not sleep after ${c}, and that is the bar for a lot of choices.`,
  },
  {
    id: 'later-you',
    move: 'later you',
    for: (c) => `Later you will thank now you for ${c}, or at least not throw a shoe.`,
    against: (c) => `Later you will blame now you for ${c}, or at least throw a shoe.`,
  },
  {
    id: 'leftovers',
    move: 'leftovers',
    for: (c) => `${capitalize(c)} keeps, like leftovers, and leftovers are how a week gets fed.`,
    against: (c) => `${capitalize(c)} keeps, like leftovers, and leftovers are how a week gets weird.`,
  },
  {
    id: 'weather',
    move: 'the weather',
    for: (c) => `${capitalize(c)} is fine in the rain, and it rains a lot here.`,
    against: (c) => `${capitalize(c)} is untested in the rain, and it rains a lot here.`,
  },
];

export const PLAIN_MODERATOR_LINES = [
  'Reminder from the person in charge: both sides here are the same bot.',
  'The person in charge stopped taking notes a while ago and nobody noticed.',
  'The person in charge says the room is fair and the chairs are not.',
  'Nothing true was hurt while this argument was happening.',
  'For the record, there is no record.',
];

export const PLAIN_VERDICT_LINES = [
  'The bot flips a coin, watches it land, and then says nothing about it.',
  'The bot made up its mind and then lost it behind the couch.',
  'One point to this side, one point to that side, one point to the couch.',
  'The bot sides with whoever is not reading this right now.',
  'The bot knows the answer. The bot is keeping it.',
];

export const PLAIN_GARY_FOOTNOTES = [
  'Gary did not pick a side. Gary never picks a side.',
  'Gary is not being difficult. Gary is just like this.',
  'Gary was asked to say more. That was the more.',
  'Gary has felt this way since before anyone brought this up.',
  'Gary is here for balance and is instead here.',
];

export const PLAIN_FLOURISHES = [
  ', probably',
  ', more or less',
  ', to be fair',
  ', who knows',
  ', or so they say',
  ', apparently',
  ', give or take',
];

export const PLAIN_LABELS = {
  question: (claim) => `ARGUING ABOUT ${claim.toUpperCase()}`,
  meta: (seed, rounds) => `seed ${seed} · ${rounds} reason(s) each · both sides get the same treatment on purpose`,
  for: 'WHY YES',
  against: 'WHY NO',
  gary: 'GARY (his own thing)',
  audit: 'FAIRNESS CHECK',
  auditSummary: (audit, status) =>
    `${audit.for.words} words for yes, ${audit.against.words} words for no · ` +
    `off by ${audit.wordDelta} (allowed ${audit.tolerance}) · ${status}`,
  auditDetail: (audit) =>
    `soft words ${audit.for.hedges} to ${audit.against.hedges} · ` +
    `strong words ${audit.for.intensifiers} to ${audit.against.intensifiers} · ` +
    'every reason on one side has a twin on the other',
  balanced: 'EVEN',
  imbalanced: 'NOT EVEN',
  verdict: 'SO WHO WINS:',
};
