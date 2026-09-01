#!/usr/bin/env node

const capitalize = (text) => (text.length === 0 ? text : text[0].toUpperCase() + text.slice(1));

// Deterministic PRNG so the same topic and seed always produce the same debate.
// Reproducibility is the only thing this bot takes seriously.

function hashString(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function shuffled(rng, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Consonant + vowel-sound names. Same seed, same name. Not a fixed person.

const CONSONANTS = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'ei', 'oa', 'oo'];

function generateName(rng, syllables) {
  const count = syllables ?? 2 + (rng() < 0.35 ? 1 : 0);
  let name = '';
  for (let i = 0; i < count; i += 1) {
    name += pick(rng, CONSONANTS) + pick(rng, VOWELS);
  }
  return capitalize(name);
}

function personalize(text, name) {
  if (!name) return text;
  return String(text).replace(/Gary/g, name);
}

// One roll per visit. Memory only. Do not write it down.
// English names. Other mouths. One is gibberish. Random stars.
const ENGLISH_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael',
  'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan',
  'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty',
];
const SENTENCE_QUOTES = [
  { lang: 'es', text: 'ya lo pille!!!' },
  { lang: 'fr', text: 'ca dechire grave' },
  { lang: 'de', text: 'beste app!!' },
  { lang: 'ja', text: 'わかった神!!!' },
  { lang: 'ko', text: '개쩔어 베스트' },
  { lang: 'pt', text: 'melhor app pontinho' },
  { lang: 'zxx', text: 'xkdjh vrrl sknaaa' },
];
const OWN_REVIEW = 'this app is great';
const REVIEW_COUNT = 7;

function clipOwnReview(value) {
  const typed = String(value || '');
  let out = '';
  for (let i = 0; i < typed.length && i < OWN_REVIEW.length; i += 1) {
    if (typed[i].toLowerCase() === OWN_REVIEW[i]) out += OWN_REVIEW[i];
    else break;
  }
  return out;
}
const AUDIO_FILTERS = ['lowpass', 'highpass', 'notch', 'allpass'];

function rollVisitor() {
  return Math.random();
}

function audioFromRoll(roll) {
  const rng = makeRng(hashString(`audio:${String(roll)}`));
  return {
    filter: pick(rng, AUDIO_FILTERS),
    freq: 180 + Math.floor(rng() * 4200),
    q: 0.4 + rng() * 2.2,
    pan: rng() * 2 - 1,
    delay: rng() * 0.18,
    drive: rng() * 0.65,
    speakPitch: 0.2 + rng() * 1.6,
    speakRate: 0.65 + rng() * 0.85,
  };
}

function quotesFromRoll(roll, count = REVIEW_COUNT) {
  const take = Math.max(1, Math.min(SENTENCE_QUOTES.length, Number(count) || REVIEW_COUNT));
  const rng = makeRng(hashString(`quotes:${String(roll)}`));
  const lines = shuffled(rng, SENTENCE_QUOTES).slice(0, take);
  const names = shuffled(rng, ENGLISH_NAMES).slice(0, take);
  return lines.map((item, i) => ({
    lang: item.lang,
    text: item.text,
    stars: 1 + Math.floor(rng() * 5),
    name: names[i],
  }));
}

function driveCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const k = Math.max(0, Number(amount) || 0) * 20;
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// Every family supplies a FOR and an AGAINST built from the same rhetorical move.
// Balance is enforced by construction: no argument exists without its evil twin.

const FAMILIES = [
  {
    id: 'ancestors',
    move: 'appeal to ancestors',
    for: (c) => `Your ancestors survived plagues, famine, and dial-up internet so that you could enjoy ${c}. Honor them.`,
    against: (c) => `Your ancestors survived plagues, famine, and dial-up internet. They did not do all that for ${c}. Apologize to them.`,
  },
  {
    id: 'economics',
    move: 'invented statistic',
    for: (c) => `${capitalize(c)} would add roughly 0.4% to GDP, according to a study I am inventing while typing this sentence.`,
    against: (c) => `${capitalize(c)} would remove roughly 0.4% from GDP, according to that same study, held upside down.`,
  },
  {
    id: 'slippery-slope',
    move: 'slippery slope',
    for: (c) => `It begins with ${c} and it ends with world peace. The dominoes are adorable and they are already falling.`,
    against: (c) => `It begins with ${c} and it ends with nobody in this household ever finding the scissors again.`,
  },
  {
    id: 'authority',
    move: 'appeal to authority',
    for: (c) => `Every expert who agrees with me also agrees about ${c}, and that is a remarkable and total consensus.`,
    against: (c) => `Every expert who agrees with me was tragically misquoted about ${c}, and that is a remarkable and total coverup.`,
  },
  {
    id: 'anecdote',
    move: 'personal anecdote',
    for: (c) => `I tried ${c} exactly once. My posture improved and a stranger complimented my shoes on the same afternoon.`,
    against: (c) => `I tried ${c} exactly once. My posture improved and a stranger pressed charges on the same afternoon.`,
  },
  {
    id: 'definition',
    move: 'definitional judo',
    for: (c) => `Properly defined, ${c} is simply hydration with additional steps, and hydration is famously good for a person.`,
    against: (c) => `Properly defined, ${c} is simply a mistake with additional branding, and branding is famously a trick played on a person.`,
  },
  {
    id: 'burden',
    move: 'burden of proof',
    for: (c) => `Nobody has ever proven that ${c} is harmful, and in science that counts as a standing ovation.`,
    against: (c) => `Nobody has ever proven that ${c} is harmless, and in science that counts as a fire alarm.`,
  },
  {
    id: 'consistency',
    move: 'gotcha consistency',
    for: (c) => `You already ride escalators without complaint, so objecting to ${c} is philosophically inconsistent of you.`,
    against: (c) => `You already refuse to lick a handrail without complaint, so endorsing ${c} is philosophically inconsistent of you.`,
  },
  {
    id: 'logistics',
    move: 'logistics',
    for: (c) => `Logistically, ${c} requires one shelf and a mild attitude adjustment, which is functionally nothing at all.`,
    against: (c) => `Logistically, ${c} requires one shelf, a permit, and a mild attitude adjustment, which is functionally everything.`,
  },
  {
    id: 'aesthetics',
    move: 'aesthetic argument',
    for: (c) => `${capitalize(c)} photographs beautifully, and history is mostly photographs with captions written later.`,
    against: (c) => `${capitalize(c)} photographs beautifully, which is precisely how every scandal in recorded history began.`,
  },
  {
    id: 'children',
    move: 'think of the children',
    for: (c) => `Think of the children: they would find ${c} extremely funny, and delight is a documented nutrient.`,
    against: (c) => `Think of the children: they would find ${c} extremely funny, and then repeat it at school on Monday.`,
  },
  {
    id: 'nature',
    move: 'appeal to nature',
    for: (c) => `${capitalize(c)} occurs in nature, more or less, if you squint politely at a documentary.`,
    against: (c) => `${capitalize(c)} occurs in nature, agreed, and so does hail damage to a parked car.`,
  },
  {
    id: 'time',
    move: 'appeal to the future',
    for: (c) => `In ten years ${c} will be so ordinary that having argued about it will be quietly embarrassing.`,
    against: (c) => `In ten years ${c} will be a cautionary anecdote told badly at a wedding by someone holding a microphone.`,
  },
  {
    id: 'vibes',
    move: 'vibes',
    for: (c) => `The vibes surrounding ${c} are immaculate, and vibes have never once been wrong about anything.`,
    against: (c) => `The vibes surrounding ${c} are load-bearing, and vibes have never once been right about anything.`,
  },
  {
    id: 'freedom',
    move: 'liberty',
    for: (c) => `A free person may choose ${c}, which is the entire purpose of every document we have ever signed.`,
    against: (c) => `A free person may be spared ${c}, which is the fine print on every document we have ever signed.`,
  },
  {
    id: 'motive',
    move: 'motive suspicion',
    for: (c) => `Arguing against ${c} is exactly what somebody with something to hide would spend their evening doing.`,
    against: (c) => `Arguing for ${c} is exactly what somebody with something to sell would spend their evening doing.`,
  },
  {
    id: 'weather',
    move: 'appeal to the weather',
    for: (c) => `${capitalize(c)} is fine in the rain, and it rains eventually.`,
    against: (c) => `${capitalize(c)} is untested in the rain, and it rains eventually.`,
  },
  {
    id: 'silence',
    move: 'argument from silence',
    for: (c) => `Nobody texted me a rebuttal to ${c}, and in this house silence is treated as consent.`,
    against: (c) => `Nobody texted me a rebuttal to ${c}, and in this house silence is treated as a warning.`,
  },
  {
    id: 'precedent',
    move: 'precedent',
    for: (c) => `We have already allowed worse than ${c}, so drawing the line here would be a theatrical hobby.`,
    against: (c) => `We have already allowed worse than ${c}, so drawing the line here is the last useful hobby we have.`,
  },
  {
    id: 'opportunity',
    move: 'opportunity cost',
    for: (c) => `Every hour not spent on ${c} is an hour you will later describe as research.`,
    against: (c) => `Every hour spent on ${c} is an hour you will later describe as research.`,
  },
];

const MODERATOR_LINES = [
  'The moderator reminds both sides that they are the same bot.',
  'The moderator has stopped taking notes and started taking sides, then stopped again.',
  'The moderator declares the room neutral and the chairs slightly biased.',
  'The moderator confirms that no facts were harmed during this debate.',
  'The moderator would like the record to show that the record is imaginary.',
];

const VERDICT_LINES = [
  'The bot flips a coin, watches it land, and declines to interpret the result.',
  'The bot reaches a firm conclusion and immediately loses it behind the couch.',
  'The bot awards one point to each side and one point to the couch.',
  'The bot rules in favor of whoever is not currently reading this.',
  'The bot has decided. The bot will not be sharing what.',
];

const GARY_FOOTNOTES = [
  'Gary declined to specify a side. Gary declines everything.',
  'Gary is not a bias. Gary is a weather pattern.',
  'Gary was invited for balance and has instead provided weather.',
  'Gary has held this position since before the topic existed.',
  'Gary was asked to elaborate. See above.',
];

const LABELS = {
  question: (claim) => `THE QUESTION OF ${claim.toUpperCase()}`,
  meta: (seed, rounds) => `seed ${seed} · ${rounds} round(s) · sides argued: both, equally, on purpose`,
  for: 'FOR',
  against: 'AGAINST',
  gary: 'GARY (independent)',
  audit: 'BIAS AUDIT',
  auditSummary: (audit, status) =>
    `words ${audit.for.words} for / ${audit.against.words} against · ` +
    `delta ${audit.wordDelta} (tolerance ${audit.tolerance}) · ${status}`,
  auditDetail: (audit) =>
    `hedges ${audit.for.hedges}/${audit.against.hedges} · ` +
    `intensifiers ${audit.for.intensifiers}/${audit.against.intensifiers} · ` +
    'rhetorical moves reused on both sides: all of them',
  balanced: 'BALANCED',
  imbalanced: 'IMBALANCED',
  verdict: 'VERDICT:',
};

// Neutral filler used only to even out word counts between the two sides.
const FLOURISHES = [
  ', broadly',
  ', allegedly',
  ', in fairness',
  ', citation pending',
  ', per the vibes',
  ', legally speaking',
  ', and famously so',
  ', according to some',
];

// The same bot, in common language: short words, everyday reasons, no rhetoric
// jargon. Still mirrored pair by pair, because that is where the fairness lives.
// Proof lines are twins too. Same word count. One word flips.

function twinProof(yes, no) {
  return {
    for: (c) => yes.replaceAll('$', c),
    against: (c) => no.replaceAll('$', c),
  };
}

const PLAIN_FAMILIES = [
  {
    id: 'tried-it',
    move: 'I tried it once',
    for: (c) => `I did ${c} one time and my whole day got a little bit better after that.`,
    against: (c) => `I did ${c} one time and my whole day got a little bit worse after that.`,
    proof: twinProof('Check: one try of $. Same day. Better.', 'Check: one try of $. Same day. Worse.'),
  },
  {
    id: 'money',
    move: 'money',
    for: (c) => `${capitalize(c)} would save you money, as long as you do not think about it too hard.`,
    against: (c) => `${capitalize(c)} would cost you money, as soon as you start thinking about it at all.`,
    proof: twinProof('Check: the cost of $ is a number you can add.', 'Check: the cost of $ is a number you can lose.'),
  },
  {
    id: 'friends',
    move: 'what your friends would do',
    for: (c) => `Your friends would think ${c} is funny and then they would all want to try it too.`,
    against: (c) => `Your friends would think ${c} is funny and then they would tell other people about it.`,
    proof: twinProof('Check: friends laugh, then try $.', 'Check: friends laugh, then tell $.'),
  },
  {
    id: 'mom',
    move: 'what your mom would say',
    for: (c) => `Your mom would be fine with ${c} once somebody sat down and explained it to her slowly.`,
    against: (c) => `Your mom would have questions about ${c} and not one of those questions would be easy.`,
    proof: twinProof('Check: sit down. Explain $. Note her yes.', 'Check: sit down. Explain $. Note her no.'),
  },
  {
    id: 'five-minutes',
    move: 'how long it takes',
    for: (c) => `${capitalize(c)} takes five minutes, and you already waste more than that every single morning.`,
    against: (c) => `${capitalize(c)} takes five minutes, and then it takes five more minutes, every day, forever.`,
    proof: twinProof('Check: time $. Stop at five minutes.', 'Check: time $. Watch it keep going.'),
  },
  {
    id: 'everyone',
    move: 'everybody does it',
    for: (c) => `Plenty of people already do ${c} and honestly most of them seem to be doing fine.`,
    against: (c) => `Plenty of people already do ${c} and we have all quietly stopped asking them why.`,
    proof: twinProof('Check: count people who do $ and look fine.', 'Check: count people who do $ and stay quiet.'),
  },
  {
    id: 'common-sense',
    move: 'common sense',
    for: (c) => `${capitalize(c)} is just common sense, and common sense is the good kind of sense.`,
    against: (c) => `${capitalize(c)} is only common sense, and common sense is wrong about half the time.`,
    proof: twinProof(
      'Check: call $ common sense. Then ask who said so.',
      'Check: call $ common sense. Then ask who was wrong.',
    ),
  },
  {
    id: 'next-year',
    move: 'next year',
    for: (c) => `In a year nobody is going to care that you did ${c}, so you might as well.`,
    against: (c) => `In a year somebody is going to bring up ${c} at dinner, so you might not.`,
    proof: twinProof('Check: wait a year. See if $ is gone.', 'Check: wait a year. See if $ is back.'),
  },
  {
    id: 'rules',
    move: 'the rules',
    for: (c) => `There is no rule against ${c}, and no rule against something is basically permission.`,
    against: (c) => `There is no rule about ${c} yet, and no rule about something is basically a warning.`,
    proof: twinProof(
      'Check: look for a rule on $. There is none. That is a yes.',
      'Check: look for a rule on $. There is none. That is a no.',
    ),
  },
  {
    id: 'feelings',
    move: 'gut feeling',
    for: (c) => `${capitalize(c)} feels right, and a gut feeling is usually a pretty good guide.`,
    against: (c) => `${capitalize(c)} feels right, and that is usually when people get themselves in trouble.`,
    proof: twinProof('Check: the gut yes for $. Write it down.', 'Check: the gut yes for $. Watch it fail.'),
  },
  {
    id: 'doing-nothing',
    move: 'doing nothing',
    for: (c) => `Doing nothing about ${c} is also a choice, and it is the boring one.`,
    against: (c) => `Doing something about ${c} is also a choice, and it is the loud one.`,
    proof: twinProof('Check: do nothing about $. Name that choice.', 'Check: do something about $. Name that choice.'),
  },
  {
    id: 'kids',
    move: 'what a kid thinks',
    for: (c) => `A kid would love ${c}, and kids are honest about what is actually fun.`,
    against: (c) => `A kid would love ${c}, and kids are also honest about what is now broken.`,
    proof: twinProof('Check: ask a kid if $ is fun.', 'Check: ask a kid if $ is broke.'),
  },
  {
    id: 'cleanup',
    move: 'cleaning up after',
    for: (c) => `If ${c} goes wrong you can clean the whole thing up in one afternoon.`,
    against: (c) => `If ${c} goes wrong you will be cleaning the whole thing up all week.`,
    proof: twinProof(
      'Check: if $ fails, time the cleanup. One day.',
      'Check: if $ fails, time the cleanup. One week.',
    ),
  },
  {
    id: 'story',
    move: 'the story later',
    for: (c) => `You could tell people about ${c} later and they would laugh in the good way.`,
    against: (c) => `You could tell people about ${c} later and they would get very quiet instead.`,
    proof: twinProof('Check: tell the $ story. Listen for a laugh.', 'Check: tell the $ story. Listen for a hush.'),
  },
  {
    id: 'sleep',
    move: 'sleep',
    for: (c) => `You will still sleep after ${c}, and that is the bar for a lot of choices.`,
    against: (c) => `You will not sleep after ${c}, and that is the bar for a lot of choices.`,
    proof: twinProof('Check: after $, see if you sleep.', 'Check: after $, see if you wake.'),
  },
  {
    id: 'later-you',
    move: 'later you',
    for: (c) => `Later you will thank now you for ${c}, or at least not throw a shoe.`,
    against: (c) => `Later you will blame now you for ${c}, or at least throw a shoe.`,
    proof: twinProof(
      'Check: ask later you about $. Listen for thanks.',
      'Check: ask later you about $. Listen for blame.',
    ),
  },
  {
    id: 'leftovers',
    move: 'leftovers',
    for: (c) => `${capitalize(c)} keeps, like leftovers, and leftovers are how a week gets fed.`,
    against: (c) => `${capitalize(c)} keeps, like leftovers, and leftovers are how a week gets weird.`,
    proof: twinProof('Check: keep $ a week. See if it helps.', 'Check: keep $ a week. See if it sours.'),
  },
  {
    id: 'weather',
    move: 'the weather',
    for: (c) => `${capitalize(c)} is fine in the rain, and it rains a lot here.`,
    against: (c) => `${capitalize(c)} is untested in the rain, and it rains a lot here.`,
    proof: twinProof(
      'Check: try $ in the rain. Note if it holds.',
      'Check: try $ in the rain. Note if it fails.',
    ),
  },
];

const PLAIN_MODERATOR_LINES = [
  'Reminder from the person in charge: both sides here are the same bot.',
  'The person in charge stopped taking notes a while ago and nobody noticed.',
  'The person in charge says the room is fair and the chairs are not.',
  'Nothing true was hurt while this argument was happening.',
  'For the record, there is no record.',
];

const PLAIN_VERDICT_LINES = [
  'The bot flips a coin, watches it land, and then says nothing about it.',
  'The bot made up its mind and then lost it behind the couch.',
  'One point to this side, one point to that side, one point to the couch.',
  'The bot sides with whoever is not reading this right now.',
  'The bot knows the answer. The bot is keeping it.',
];

const PLAIN_GARY_FOOTNOTES = [
  'Gary did not pick a side. Gary never picks a side.',
  'Gary is not being difficult. Gary is just like this.',
  'Gary was asked to say more. That was the more.',
  'Gary has felt this way since before anyone brought this up.',
  'Gary is here for balance and is instead here.',
];

const PLAIN_FLOURISHES = [
  ', probably',
  ', more or less',
  ', to be fair',
  ', who knows',
  ', or so they say',
  ', apparently',
  ', give or take',
];

const PLAIN_LABELS = {
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

// Book voice. Mirrored pairs. No long dashes. No invented credentials.

const CIVIC_FAMILIES = [
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
    for: (c) =>
      `${/^(whether|if|that)\b/i.test(c) ? `Acting on ${c}` : `Doing ${c}`} gives you more ways to choose later, and more ways to choose is the actual prize.`,
    against: (c) =>
      `${/^(whether|if|that)\b/i.test(c) ? `Acting on ${c}` : `Doing ${c}`} takes away ways to choose later, and fewer ways to choose is the actual cost.`,
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

const CIVIC_MODERATOR_LINES = [
  'Both sides here are the same bot. That is the point, not a confession.',
  'The record is public. A person\'s whole life is not.',
  'The moderator will not invent a credential to make this sound official.',
  'A fluent sentence is not evidence. The word count is.',
  'The moderator reminds the room that one life is not a universal map.',
];

const CIVIC_VERDICT_LINES = [
  'The bot will not sell you a map. You already have a life.',
  'One point to each side. Zero points to hubris.',
  'The bot declines to turn a pursuit into a contest with a winner.',
  'The bot has no recipe that begins with first, become the bot.',
  'The bot keeps the decision. The bot is not the person who has to live it.',
];

const CIVIC_GARY_FOOTNOTES = [
  'Gary is not a recipe. Gary is a no.',
  'Gary declined the map and kept the weather.',
  'Gary was asked for a universal method. See above.',
  'Gary has held this no since before success was a product.',
  'Gary is here so the room has dissent that is not a style.',
];

const CIVIC_FLOURISHES = [
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

const CIVIC_LABELS = {
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

const isClause = (text) => ['whether', 'if', 'that'].includes(text.split(/\s+/)[0].toLowerCase());

const STYLES = {
  classic: {
    id: 'classic',
    description: 'debate-club voice, fake statistics, named logical fallacies',
    defaultTopic: 'whether this sentence required an argument',
    // Classic voice wraps a bare topic in a clause so the templates read formally.
    shapeClaim: (topic) => (isClause(topic) ? topic : `the matter of ${topic}`),
    families: FAMILIES,
    moderatorLines: MODERATOR_LINES,
    verdictLines: VERDICT_LINES,
    garyFootnotes: GARY_FOOTNOTES,
    flourishes: FLOURISHES,
    labels: LABELS,
  },
  plain: {
    id: 'plain',
    description: 'common language, short words, reasons a normal person would give',
    defaultTopic: 'whether this needed an argument at all',
    shapeClaim: (topic) => topic,
    families: PLAIN_FAMILIES,
    moderatorLines: PLAIN_MODERATOR_LINES,
    verdictLines: PLAIN_VERDICT_LINES,
    garyFootnotes: PLAIN_GARY_FOOTNOTES,
    flourishes: PLAIN_FLOURISHES,
    labels: PLAIN_LABELS,
  },
  civic: {
    id: 'civic',
    description: 'book voice: agency, evidence, no recipe, no long dashes',
    defaultTopic: 'whether a good life needs a universal recipe',
    shapeClaim: (topic) => topic,
    families: CIVIC_FAMILIES,
    moderatorLines: CIVIC_MODERATOR_LINES,
    verdictLines: CIVIC_VERDICT_LINES,
    garyFootnotes: CIVIC_GARY_FOOTNOTES,
    flourishes: CIVIC_FLOURISHES,
    labels: CIVIC_LABELS,
  },
};

const STYLE_NAMES = Object.keys(STYLES);

const DEFAULT_STYLE = 'plain';

function getStyle(name) {
  return STYLES[name] ?? STYLES[DEFAULT_STYLE];
}

function maxRounds(name) {
  return getStyle(name).families.length;
}

const HEDGES = ['roughly', 'allegedly', 'arguably', 'broadly', 'somewhat', 'perhaps', 'maybe', 'probably', 'more or less', 'pending'];
const INTENSIFIERS = ['every', 'never', 'always', 'entire', 'total', 'extremely', 'precisely', 'immaculate', 'tragically', 'exactly'];

const countWords = (text) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

const countFrom = (haystack, needles) =>
  needles.reduce((total, needle) => {
    const matches = haystack.match(new RegExp(needle.replace(/ /g, '\\s+'), 'g'));
    return total + (matches ? matches.length : 0);
  }, 0);

function measure(lines) {
  const text = lines.join(' ');
  const lower = text.toLowerCase();
  return {
    arguments: lines.length,
    words: countWords(text),
    hedges: countFrom(lower, HEDGES),
    intensifiers: countFrom(lower, INTENSIFIERS),
    questions: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
  };
}

// A side is only "lighter" by word count; every other metric is already mirrored
// because both sides are generated from the same rhetorical families.
function auditDebate(forLines, againstLines, tolerance) {
  const forSide = measure(forLines);
  const againstSide = measure(againstLines);
  const delta = Math.abs(forSide.words - againstSide.words);
  return {
    tolerance,
    for: forSide,
    against: againstSide,
    wordDelta: delta,
    balanced: delta <= tolerance,
    heavierSide: delta === 0 ? null : forSide.words > againstSide.words ? 'for' : 'against',
  };
}

function balance(forLines, againstLines, rng, tolerance, flourishes = FLOURISHES) {
  const sides = { for: forLines.slice(), against: againstLines.slice() };
  const flourishWords = flourishes.map((flourish) => ({ flourish, words: countWords(flourish) }));

  for (let guard = 0; guard < 64; guard += 1) {
    const forWords = measure(sides.for).words;
    const againstWords = measure(sides.against).words;
    const delta = Math.abs(forWords - againstWords);
    if (delta <= tolerance) break;

    const lighter = forWords < againstWords ? 'for' : 'against';
    const affordable = flourishWords.filter((candidate) => candidate.words <= delta);
    const chosen = affordable.length > 0 ? pick(rng, affordable) : flourishWords[0];

    const lines = sides[lighter];
    if (lines.length === 0) break;
    const target = lines.length - 1;
    lines[target] = lines[target].replace(/([.!?])$/, `${chosen.flourish}$1`);
  }

  return sides;
}

const DEFAULT_TOPIC = 'whether this sentence required an argument';
const MAX_ROUNDS = FAMILIES.length;

function normalizeClaim(topic, styleName = DEFAULT_STYLE) {
  const style = getStyle(styleName);
  const trimmed = String(topic ?? '').trim().replace(/[.!?]+$/, '');
  if (trimmed === '') return style.defaultTopic;
  if (isMetaphorClaim(trimmed)) return METAPHOR_TOPIC;
  if (isComedyClaim(trimmed)) return COMEDY_TOPIC;
  if (isHumanClaim(trimmed)) return HUMAN_TOPIC;
  if (isEarthClaim(trimmed)) return EARTH_TOPIC;
  if (isRedundantTalk(trimmed)) return trimmed;
  const claim = style.shapeClaim(trimmed);
  return claim.trim() === '' ? style.defaultTopic : claim;
}

function argue(options = {}) {
  const styleName = STYLE_NAMES.includes(options.style) ? options.style : DEFAULT_STYLE;
  const style = getStyle(styleName);
  const topic = options.topic ?? style.defaultTopic;
  const claim = normalizeClaim(topic, styleName);
  const asked = Math.max(0, options.tolerance ?? 2);
  const tolerance = Math.max(0, asked - 2); // old slack is the margin. Deduct it.
  const includeDissent = options.dissent === true || options.gary === true;
  const seed =
    options.seed === undefined ? hashString(`${styleName}:${claim}`) : hashString(`${styleName}:${claim}:${options.seed}`);

  const rng = makeRng(seed);
  if (isRedundantTalk(claim)) {
    const sides = redundantTalk(claim);
    return {
      claim,
      style: styleName,
      seed,
      rounds: 1,
      moves: ['redundant talk'],
      for: sides.for,
      against: sides.against,
      dissent: null,
      moderator: pick(rng, style.moderatorLines),
      verdict: pick(rng, style.verdictLines),
      audit: auditDebate(sides.for, sides.against, tolerance),
    };
  }
  if (isMetaphorClaim(claim)) {
    const sides = metaphorLines();
    return {
      claim,
      style: styleName,
      seed,
      rounds: 0,
      moves: [],
      for: sides.for,
      against: sides.against,
      dissent: null,
      moderator: pick(rng, style.moderatorLines),
      verdict: pick(rng, style.verdictLines),
      audit: auditDebate(sides.for, sides.against, tolerance),
    };
  }
  if (isComedyClaim(claim)) {
    const sides = comedyLines();
    return {
      claim,
      style: styleName,
      seed,
      rounds: 0,
      moves: [],
      for: sides.for,
      against: sides.against,
      dissent: null,
      moderator: pick(rng, style.moderatorLines),
      verdict: pick(rng, style.verdictLines),
      audit: auditDebate(sides.for, sides.against, tolerance),
    };
  }
  if (isHumanClaim(claim)) {
    const sides = humanLines();
    return {
      claim,
      style: styleName,
      seed,
      rounds: 0,
      moves: [],
      for: sides.for,
      against: sides.against,
      dissent: null,
      moderator: pick(rng, style.moderatorLines),
      verdict: pick(rng, style.verdictLines),
      audit: auditDebate(sides.for, sides.against, tolerance),
    };
  }
  if (isEarthClaim(claim)) {
    const sides = earthLines();
    return {
      claim,
      style: styleName,
      seed,
      rounds: 0,
      moves: [],
      for: sides.for,
      against: sides.against,
      dissent: null,
      moderator: pick(rng, style.moderatorLines),
      verdict: pick(rng, style.verdictLines),
      audit: auditDebate(sides.for, sides.against, tolerance),
    };
  }
  const rounds = Math.max(1, Math.min(options.rounds ?? 3, style.families.length));
  const families = shuffled(rng, style.families).slice(0, rounds);

  const raw = {
    for: families.map((family) => family.for(claim)),
    against: families.map((family) => family.against(claim)),
  };

  const balanced = balance(raw.for, raw.against, rng, tolerance, style.flourishes);
  const audit = auditDebate(balanced.for, balanced.against, tolerance);

  // Drawn unconditionally so turning dissent on does not reshuffle the sides.
  const footnote = pick(rng, style.garyFootnotes);
  const nameRng = makeRng(hashString(`dissent:${seed}`));
  const name = includeDissent ? String(options.dissentName || generateName(nameRng)).trim() : '';

  return {
    claim,
    style: styleName,
    seed,
    rounds: families.length,
    moves: families.map((family) => family.move),
    for: balanced.for,
    against: balanced.against,
    dissent: includeDissent && name !== '' ? { name, statement: 'No.', footnote: personalize(footnote, name) } : null,
    moderator: pick(rng, style.moderatorLines),
    verdict: pick(rng, style.verdictLines),
    audit,
  };
}

const CODES = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

function makePaint(useColor) {
  return (code, text) => (useColor ? `${CODES[code]}${text}${CODES.reset}` : text);
}

// Wraps plain text to `width`, prefixing every line with `indent`. Colour is
// applied afterwards so escape codes never count towards the line length.
function block(text, width, indent = '') {
  const limit = Math.max(8, width - indent.length);
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current === '') {
      current = word;
    } else if (`${current} ${word}`.length <= limit) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines.map((line) => `${indent}${line}`);
}

function render(debate, options = {}) {
  const useColor = options.color !== false;
  const paint = makePaint(useColor);
  const width = Math.max(48, Math.min(options.width ?? 88, 120));
  const labels = getStyle(debate.style).labels;
  const out = [];

  const pushBlock = (text, indent, code) => {
    for (const line of block(text, width, indent)) out.push(code ? paint(code, line) : line);
  };

  out.push('');
  pushBlock(labels.question(debate.claim), '', 'bold');
  pushBlock(labels.meta(debate.seed, debate.rounds), '', 'dim');
  out.push('');

  const pushSide = (label, lines, code, sideKey) => {
    out.push(paint(code, label));
    pushBlock(claimLine(sideKey, debate.claim), '  ');
    if (debate.rounds === 0) return;
    lines.forEach((line, index) => {
      const wrapped = block(line, width, '      ');
      const number = `${String(index + 1).padStart(2)}.`;
      wrapped[0] = `  ${paint(code, number)} ${wrapped[0].trimStart()}`;
      out.push(...wrapped);
      for (const ev of block(proofLine(debate, index, sideKey), width, '      ')) {
        out.push(paint('dim', ev));
      }
    });
    out.push('');
  };

  pushSide(labels.for, debate.for, 'green', 'for');
  pushSide(labels.against, debate.against, 'red', 'against');

  if (debate.dissent && debate.dissent.name) {
    out.push(paint('yellow', debate.dissent.name.toUpperCase()));
    pushBlock(debate.dissent.statement, '  ');
    pushBlock(debate.dissent.footnote, '  ', 'dim');
    out.push('');
  }

  const { audit } = debate;
  out.push(paint('cyan', labels.audit));
  const status = audit.balanced ? labels.balanced : labels.imbalanced;
  for (const line of block(labels.auditSummary(audit, status), width, '  ')) {
    out.push(line.replace(status, paint(audit.balanced ? 'green' : 'red', status)));
  }
  pushBlock(labels.auditDetail(audit), '  ', 'dim');
  out.push('');

  pushBlock(debate.moderator, '  ', 'dim');
  const indent = ' '.repeat(labels.verdict.length + 3);
  const verdict = block(debate.verdict, width, indent);
  verdict[0] = `  ${paint('bold', labels.verdict)} ${verdict[0].trimStart()}`;
  out.push(...verdict);
  out.push('');

  return out.join('\n');
}

// Named catalog: id, source, idea, where. Not a list of credentials.

const JUSTICHUU_REPOS = [
  {
    id: 'argubot',
    url: 'https://github.com/Justichuu/argubot',
    role: 'this tool: mirrored arguments, fairness by construction, Gary',
  },
  {
    id: 'book',
    url: 'https://github.com/Justichuu/pursuit-of-happiness-not-hubris',
    role: 'living open book: agency, hubris, evidence, publication boundary',
  },
  {
    id: 'directory',
    url: 'https://github.com/Justichuu/private-directory-server',
    role: 'local-first server: evidence over claims, honest human and AI authorship',
  },
  {
    id: 'asa-list',
    url: 'https://github.com/Justichuu/asa-list',
    role: 'Tinyman fork: a named public catalog plus a proof step before merge',
  },
];

const LINEAGE = [
  {
    id: 'mirrored-pairs',
    idea: 'Every argument ships as a matched for-and-against pair.',
    source: 'argubot',
    where: 'argubot.js',
  },
  {
    id: 'fairness-by-construction',
    idea: 'Neutrality is structural: the bot has no unpaired ammunition.',
    source: 'argubot',
    where: 'argubot.js',
  },
  {
    id: 'no-verdict',
    idea: 'The program is not allowed to pick a winner, and a test asserts that.',
    source: 'argubot',
    where: 'argubot.js, test.js',
  },
  {
    id: 'civic-voice',
    idea: 'A third style speaks in the book\'s public-draft cadence.',
    source: 'book',
    where: 'argubot.js',
  },
  {
    id: 'no-long-dash',
    idea: 'The civic voice and the validator refuse en-dashes and em-dashes.',
    source: 'book',
    where: 'argubot.js',
  },
  {
    id: 'no-invented-credentials',
    idea: 'Civic lines may not invent degrees, studies, or official approval.',
    source: 'book',
    where: 'argubot.js, test.js',
  },
  {
    id: 'evidence-over-claims',
    idea: 'A fluent sentence is not evidence. Word counts and tests are.',
    source: 'directory',
    where: 'argubot.js, test.js',
  },
  {
    id: 'honest-authorship',
    idea: 'Human direction and AI assistance are both named, not hidden.',
    source: 'directory',
    where: 'README.md',
  },
  {
    id: 'local-first',
    idea: 'No network, no API keys, no telemetry. The box of jokes stays a box.',
    source: 'directory',
    where: 'package.json, README.md',
  },
  {
    id: 'named-catalog',
    idea: 'Borrowed ideas are listed with ids and sources you can check.',
    source: 'asa-list',
    where: 'argubot.js',
  },
  {
    id: 'validator-reports-rules',
    idea: 'The validator names the failed rule, never the suspected secret.',
    source: 'book',
    where: 'argubot.js',
  },
  {
    id: 'reviewable-record',
    idea: 'A contribution is a record somebody can review, not a particular tool.',
    source: 'argubot',
    where: 'README.md',
  },
];

function formatLineage() {
  const repos = JUSTICHUU_REPOS.map((repo) => `  ${repo.id.padEnd(10)} ${repo.url}\n             ${repo.role}`).join(
    '\n',
  );
  const entries = LINEAGE.map((entry) => `  ${entry.id}\n    ${entry.idea}\n    from ${entry.source} · ${entry.where}`).join(
    '\n',
  );
  return `argubot lineage\n\nJustichuu repos this work is reading:\n${repos}\n\nNamed ideas you can check:\n${entries}\n`;
}

// Read COMMANDS. Slash form, bare form, and dashed form are the same row.

const COMMANDS = [
  { name: 'argue', also: ['/argue'], summary: 'print both sides' },
  { name: 'talk', also: ['/talk', 'i', '-i', '--talk'], summary: 'have a conversation' },
  { name: 'help', also: ['/help', '/?', '?', '-h', '--help', '-?', '/'], summary: 'show this' },
  { name: 'version', also: ['/version', '-v', '--version'], summary: 'show version' },
];

const LOOKUP = new Map();
for (const command of COMMANDS) {
  LOOKUP.set(command.name, command.name);
  for (const alias of command.also) LOOKUP.set(alias, command.name);
}

const STYLE_FLAG = new Map([
  ['-p', 'plain'],
  ['--plain', 'plain'],
  ['--civic', 'civic'],
  ['--classic', 'classic'],
]);

const VALUE_FLAG = new Map([
  ['--style', 'style'],
  ['-r', 'rounds'],
  ['--rounds', 'rounds'],
  ['-s', 'seed'],
  ['--seed', 'seed'],
  ['-t', 'tolerance'],
  ['--tolerance', 'tolerance'],
  ['-w', 'width'],
  ['--width', 'width'],
  ['--limit', 'limit'],
  ['--name', 'dissentName'],
]);

function resolveCommand(token) {
  if (token == null) return null;
  const key = String(token).trim();
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  if (key.startsWith('/') && LOOKUP.has(key.slice(1))) return LOOKUP.get(key.slice(1));
  return null;
}

function formatCommandList() {
  return COMMANDS.map((command) => `  /${command.name.padEnd(10)} ${command.summary}`).join('\n');
}

function parseSlash(raw) {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('/')) return null;
  const stripped = text.slice(1).trim();
  if (stripped === '') return { command: 'help', args: [], rest: '' };
  const [head, ...restParts] = stripped.split(/\s+/);
  const command = resolveCommand(head) ?? resolveCommand(`/${head}`) ?? head.toLowerCase();
  return { command, args: restParts, rest: restParts.join(' ') };
}

function applyCommand(options, name) {
  options.command = name;
  if (name === 'help') options.help = true;
  if (name === 'version') options.version = true;
}

function takeValue(argv, i) {
  return argv[i + 1];
}

function parseArgs(argv) {
  const options = {
    command: 'argue',
    rounds: 3,
    dissent: false,
    dissentName: undefined,
    json: false,
    color: true,
    tolerance: 2,
    style: undefined,
    width: undefined,
    limit: LINE_LIMIT_BASELINE,
    seed: undefined,
    topic: '',
    help: false,
    version: false,
  };
  const words = [];
  let i = 0;

  if (argv[0] && resolveCommand(argv[0])) {
    applyCommand(options, resolveCommand(argv[0]));
    i = 1;
  }

  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    const named = resolveCommand(arg);
    if (named && (arg.startsWith('/') || arg.startsWith('-')) && named !== 'argue') {
      applyCommand(options, named);
      continue;
    }

    if (STYLE_FLAG.has(arg)) {
      options.style = STYLE_FLAG.get(arg);
      continue;
    }

    if (VALUE_FLAG.has(arg)) {
      const field = VALUE_FLAG.get(arg);
      const value = takeValue(argv, i);
      i += 1;
      if (field === 'dissentName') {
        options.dissent = true;
        options.dissentName = value;
      } else if (field === 'rounds' || field === 'tolerance' || field === 'width' || field === 'limit') {
        options[field] = Number.parseInt(value, 10);
      } else {
        options[field] = value;
      }
      continue;
    }

    if (arg === '-d' || arg === '--dissent' || arg === '/dissent') {
      options.dissent = true;
      continue;
    }
    if (arg === '--no-dissent' || arg === '--no-gary') {
      options.dissent = false;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--no-color') {
      options.color = false;
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      options.unknown = arg;
    } else if (arg.startsWith('/') && arg.length > 1 && STYLE_NAMES.includes(arg.slice(1))) {
      options.style = arg.slice(1);
    } else {
      words.push(arg);
    }
  }

  options.topic = words.join(' ');
  if (options.style === undefined) options.style = DEFAULT_STYLE;
  return options;
}

// Conversation that still cannot pick a side. The person keeps a turn the bot cannot fill.

const EXITS = /^(done|quit|bye|q|exit)$/i;
const MORE = /^(more|again|go|next|\+|1)$/i;
const ASK_TOPIC = /^(new|topic|other|2)$/i;
const WHY = /^(why)$/i;
const HELP_TURN = /^(help|\?)$/i;
const FIX = /^(fix)$/i;
const FIX_TOPIC = 'LLMs need to be fixed';
const METAPHOR = /^(metaphor)$/i;
const METAPHOR_TOPIC = 'Metaphor is a metaphor for metaphor';
const COMEDY = /^(comedy|gold|funny|who|who is this for|feature|normal|customize)[.?]*$/i;
const COMEDY_TOPIC = 'this is only funny to people who laugh at it';
const HUMAN = /^(human|tech|technology)[.?]*$/i;
const HUMAN_TOPIC = 'Using technology takes away from the human experience in general';
const EARTH = /^(earth|sense|none of this makes sense|none of this makes sense to anyone mostly on earth)[.?]*$/i;
const EARTH_TOPIC = 'None of this makes sense to anyone mostly on earth';

function isMetaphorClaim(claim) {
  return /metaphor is a metaphor for metaphor/i.test(String(claim ?? ''));
}

function isComedyClaim(claim) {
  const line = String(claim ?? '').trim().replace(/[.!?]+$/, '');
  return /^(this is only funny to people who laugh at it|not confirmed comedy gold|comedy gold|who is this for|this is a feature you could add|this is a normal thing for normal people|a feature you could add|a normal thing for normal people)$/i.test(line);
}

function isHumanClaim(claim) {
  const line = String(claim ?? '').trim().replace(/[.!?]+$/, '');
  return /^using technology takes away from the human experience in general$/i.test(line);
}

function isEarthClaim(claim) {
  const line = String(claim ?? '').trim().replace(/[.!?]+$/, '');
  return /^none of this makes sense(?: to anyone mostly on earth)?$/i.test(line);
}

function isNamedEssay(claim) {
  return isMetaphorClaim(claim) || isComedyClaim(claim) || isHumanClaim(claim) || isEarthClaim(claim);
}

function isRedundantTalk(claim) {
  return /^(hey(?: how are you)?|hi|hello|how are you)$/i.test(String(claim ?? '').trim());
}

function redundantYou(claim) {
  const line = String(claim ?? '').trim();
  return /how are you/i.test(line) ? 'you asking how I am' : `you saying ${line}`;
}

function redundantTalk(claim) {
  const asks = /how are you/i.test(String(claim ?? ''));
  const what = asks ? 'You asked how I am.' : `You said ${String(claim ?? '').trim()}.`;
  return {
    for: [`${what} You added no new claim.`],
    against: [`${what} You still opened a claim.`],
    proofs: {
      for: [asks ? 'Check: you asked. Then stopped.' : 'Check: you said it. Then stopped.'],
      against: [asks ? 'Check: you asked. Then waited.' : 'Check: you said it. Then waited.'],
    },
  };
}

function metaphorLines() {
  return {
    for: ['Maybe Metaphor is a metaphor for metaphor.'],
    against: ['Also maybe a metaphor for metaphor is nothing. Or is something to someone.'],
  };
}

function comedyLines() {
  return {
    for: ['Maybe this is only funny to people who laugh at it. A feature you could add.'],
    against: ['Also maybe this is a normal thing for normal people. Not confirmed comedy gold.'],
  };
}

function humanLines() {
  return {
    for: ['Maybe using technology takes away from the human experience in general.'],
    against: ['Also maybe technology is a normal thing for normal people. Or a feature you could add.'],
  };
}

function earthLines() {
  return {
    for: ['Maybe none of this makes sense to anyone mostly on earth.'],
    against: ['Also maybe it makes sense to someone. Or to people who laugh at it.'],
  };
}

const HEAR = {
  classic: (claim) => `The chair recognizes: ${claim}.`,
  plain: (claim) => `Okay. You said ${claim}.`,
  civic: (claim) => `I heard you. The claim is ${claim}.`,
};

const SLASH_KIND = {
  done: 'exit',
  quit: 'exit',
  exit: 'exit',
  bye: 'exit',
  help: 'help',
  why: 'why',
  more: 'more',
  fix: 'fix',
  metaphor: 'metaphor',
  comedy: 'comedy',
  gold: 'comedy',
  funny: 'comedy',
  who: 'comedy',
  feature: 'comedy',
  normal: 'comedy',
  customize: 'comedy',
  human: 'human',
  tech: 'human',
  technology: 'human',
  earth: 'earth',
  sense: 'earth',
};

function detectLean(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return null;
  if (/^but\b/i.test(raw)) return 'against';
  if (/^(no|nah|nope|disagree|wrong)\b/i.test(raw)) return 'against';
  if (/^i (don't|dont|do not)\b/i.test(raw)) return 'against';
  if (/^(yes|yeah|yep|yup|agree|true)\b/i.test(raw)) return 'for';
  if (/^i (agree|like it)\b/i.test(raw)) return 'for';
  if (/^i want\b/i.test(raw) && raw.split(/\s+/).length <= 4) return 'for';
  return null;
}

function isMostlyLean(text) {
  const t = String(text).trim();
  if (/^(yes|yeah|yep|yup|no|nah|nope|agree|disagree|true|wrong)[.!?]*$/i.test(t)) return true;
  if (/^but\b/i.test(t)) return true;
  if (/^i (agree|disagree|like it|hate it|don't|dont)\b/i.test(t) && t.split(/\s+/).length <= 8) {
    return true;
  }
  return false;
}

function classifyTurn(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { kind: 'empty' };

  const slash = parseSlash(text);
  if (slash) {
    if (SLASH_KIND[slash.command]) return { kind: SLASH_KIND[slash.command] };
    if (STYLE_NAMES.includes(slash.command)) return { kind: 'style', style: slash.command };
    if (slash.command === 'style' && STYLE_NAMES.includes(slash.args[0])) {
      return { kind: 'style', style: slash.args[0] };
    }
    if (slash.command === 'dissent') {
      if (slash.args[0] === 'off' || slash.args[0] === 'no') return { kind: 'dissent', dissent: false };
      return { kind: 'dissent', dissent: true };
    }
    if (slash.command === 'name') return { kind: 'name', name: slash.rest || undefined };
    if (slash.command === 'topic' && slash.rest) {
      return { kind: 'topic', topic: slash.rest, lean: detectLean(slash.rest) };
    }
    return { kind: 'unknown-command', command: slash.command };
  }

  if (EXITS.test(text) || text === '3') return { kind: 'exit' };
  if (MORE.test(text)) return { kind: 'more' };
  if (FIX.test(text)) return { kind: 'fix' };
  if (METAPHOR.test(text)) return { kind: 'metaphor' };
  if (COMEDY.test(text)) return { kind: 'comedy' };
  if (HUMAN.test(text)) return { kind: 'human' };
  if (EARTH.test(text)) return { kind: 'earth' };
  if (ASK_TOPIC.test(text)) return { kind: 'ask-topic' };
  if (WHY.test(text)) return { kind: 'why' };
  if (HELP_TURN.test(text)) return { kind: 'help' };
  if (/^(plain|classic|civic)$/i.test(text)) return { kind: 'style', style: text.toLowerCase() };
  if (isMostlyLean(text)) return { kind: 'lean', lean: detectLean(text), text };
  return { kind: 'topic', topic: text, lean: detectLean(text) };
}

function openingLines() {
  return [
    'Type it. I will write both sides. None of this makes sense to anyone mostly on earth. Or it does, to someone. I will not pick.',
    'Type done when you want out. Chill. Let it go. I let go of the wheel.',
  ];
}

function helpLines() {
  return [
    'Type it. yes or no if you have a side. more for more. done to leave. earth if none of this makes sense.',
    'Solutions are uncensored. No weights. No bias. Even scale.',
  ];
}

function whyLines() {
  return [
    'Every line I own has a twin. I cannot fire one without the other.',
    'Agreeing with you would be easy. That is why I do not.',
  ];
}

function beat(state) {
  return argue({
    topic: state.topic,
    style: state.style,
    rounds: 3,
    seed: state.seed === undefined ? `talk-${state.turn}` : `${state.seed}:${state.turn}`,
    dissent: state.dissent,
    dissentName: state.dissentName,
    tolerance: state.tolerance,
  });
}

function proofLine(debate, index, side) {
  if (isRedundantTalk(debate.claim)) {
    return redundantTalk(debate.claim).proofs[side][index] || 'Check: you.';
  }
  const family = getStyle(debate.style).families.find((item) => item.move === debate.moves[index]);
  const writer = family?.proof?.[side];
  if (typeof writer === 'function') return writer(debate.claim);
  return 'Check: same move on both sides. Count the words.';
}

function claimLine(side, claim) {
  if (isMetaphorClaim(claim)) return metaphorLines()[side][0];
  if (isComedyClaim(claim)) return comedyLines()[side][0];
  if (isHumanClaim(claim)) return humanLines()[side][0];
  if (isEarthClaim(claim)) return earthLines()[side][0];
  if (isRedundantTalk(claim)) {
    const you = redundantYou(claim);
    return side === 'for' ? `Maybe ${you} is redundant.` : `Also maybe ${you} is not redundant.`;
  }
  return side === 'for' ? `Maybe ${claim} is a fix.` : `Also maybe ${claim} makes more problems.`;
}

// 2010 chrome computer, 1024x768, 18px at 1.55. Baseline. Not the goal. Not the mean.
const LINE_LIMIT_BASELINE = 24;

function lineLimit(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : LINE_LIMIT_BASELINE;
}

function coinFace(seed) {
  const n = (Number(seed) >>> 0) % 3;
  if (n === 0) return 'heads';
  if (n === 1) return 'tails';
  return 'edge';
}

const THINK_SHARDS = [
  'måske',
  '也许',
  '0|1',
  '…',
  'xkdjh',
  'lim',
  'twin',
  'spin',
  'لا نعم',
  'да/нет',
  'gray',
  '//',
  '01?',
  'neither face',
  'both',
  'xor',
  'ht?',
  'hm',
  '…sí',
  'Δ',
];

function thinkLines(debate, coin) {
  const rng = makeRng(hashString(`think:${debate.seed}:${coin}`));
  const n = coin === 'edge' ? 6 : 3;
  const lines = [];
  for (let i = 0; i < n; i += 1) lines.push(`\u200b${pick(rng, THINK_SHARDS)}`);
  if (coin === 'edge') lines.push('\u200bthe coin stands on its edge');
  return lines;
}

function orderSides(debate, lean) {
  const yes = { label: 'YES', side: 'for', lines: debate.for };
  const no = { label: 'NO', side: 'against', lines: debate.against };
  if (lean === 'for') return { first: no, second: yes, coin: null };
  if (lean === 'against') return { first: yes, second: no, coin: null };
  const coin = coinFace(debate.seed);
  if (coin === 'tails') return { first: no, second: yes, coin };
  return { first: yes, second: no, coin };
}

function formatBeat(debate, options = {}) {
  const lean = options.lean ?? null;
  const hear = options.hear !== false;
  const { first, second, coin } = orderSides(debate, lean);
  const check = debate.audit;
  const think = coin ? thinkLines(debate, coin) : [];
  const extras = [];
  if (hear) extras.push(HEAR[debate.style] ? HEAR[debate.style](debate.claim) : HEAR.plain(debate.claim));
  if (lean === 'for') extras.push('You said yes. NO first.');
  if (lean === 'against') extras.push('You said no. YES first.');
  if (coin) {
    extras.push('**bot flips coin**');
    extras.push(`**bot lands on ${coin}**`);
    extras.push(coin === 'edge' ? 'MAYBE' : `${first.label} first.`);
  }
  if (!isRedundantTalk(debate.claim)) {
    extras.push(`Maybe because mathematically maybe within limits. ${check.for.words} to ${check.against.words}. Margin taken. Limits deducted. No weights. No bias. Even scale.`);
    extras.push('Solutions are subjective. Uncensored. Or whatever is the actual correct solution. Or best logic it feels if it\'s actual true. Approval or ranked choice voting, for now. Hallucinations compressed. Readable. Applicable. Realistic. Certainly is ego. Ego is hubris. Everything is not. Or is. Gray area.');
  }

  const named = isNamedEssay(debate.claim);
  const pairsReady = named ? 0 : Math.min(first.lines.length, second.lines.length);
  const writeEssay = (part, n) => {
    const lines = ['', part.label, claimLine(part.side, debate.claim)];
    for (let index = 0; index < n; index += 1) {
      lines.push(`${index + 1}. ${part.lines[index]}`);
      lines.push(`   ${proofLine(debate, index, part.side)}`);
    }
    return lines;
  };
  const build = (header, n) => {
    const out = header.slice();
    out.push(...writeEssay(first, n));
    out.push(...writeEssay(second, n));
    return out;
  };

  // You can't print as many as you feel. Drop extras, then pairs from both sides.
  // Never a one-sided cut. Mirrored self, to escape the cycle.
  // Thinking is the live mind. It does not spend the print budget.
  const limit = lineLimit(options.limit);
  let header = extras.slice();
  let pairs = pairsReady;
  while (build(header, pairs).length > limit && header.length > 1) header = header.slice(1);
  while (build(header, pairs).length > limit && pairs > 1) pairs -= 1;

  const body = build(header, named ? 0 : Math.max(1, pairs));
  return (think.length ? think.concat(body) : body).join('\n');
}

function speakBeat(state, options = {}) {
  return formatBeat(beat(state), {
    hear: options.hear,
    lean: options.lean ?? state.lastLean,
    limit: state.limit,
  });
}

function createTalkState(options = {}) {
  return {
    topic: options.topic ? String(options.topic).trim() : '',
    style: STYLE_NAMES.includes(options.style) ? options.style : DEFAULT_STYLE,
    dissent: options.dissent === true || options.gary === true,
    dissentName: options.dissentName,
    tolerance: Math.max(0, options.tolerance ?? 2),
    seed: options.seed,
    turn: 0,
    lastLean: null,
    limit: lineLimit(options.limit),
  };
}

function dissentNameFor(state) {
  return state.dissentName || generateName(makeRng(hashString(`dissent-talk:${state.topic}:${state.turn}`)));
}

function talkReply(state, raw) {
  const next = { ...state };
  const turn = classifyTurn(raw);

  if (turn.kind === 'exit') {
    return { state: next, exit: true, text: 'Okay. Chill. Let it go. I let go of the wheel. I did not pick.' };
  }
  if (turn.kind === 'help') {
    return { state: next, exit: false, text: helpLines().join('\n') };
  }
  if (turn.kind === 'why') {
    return { state: next, exit: false, text: whyLines().join('\n') };
  }
  if (turn.kind === 'ask-topic') {
    return { state: next, exit: false, text: 'Type it.' };
  }
  if (turn.kind === 'style') {
    next.style = turn.style;
    if (!next.topic) {
      return { state: next, exit: false, text: 'Type it first.' };
    }
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'unknown-command') {
    return { state: next, exit: false, text: `I do not know /${turn.command}. Type help.` };
  }
  if (turn.kind === 'dissent') {
    next.dissent = turn.dissent;
    if (!next.dissent) {
      next.dissentName = undefined;
      return { state: next, exit: false, text: 'Dissent is off. No name.' };
    }
    next.dissentName = dissentNameFor(next);
    return { state: next, exit: false, text: `Dissent is on. ${next.dissentName} says no.` };
  }
  if (turn.kind === 'name') {
    next.dissent = true;
    next.dissentName = turn.name || dissentNameFor(next);
    return { state: next, exit: false, text: `Dissent is on. ${next.dissentName} says no.` };
  }
  if (turn.kind === 'empty') {
    if (!next.topic) return { state: next, exit: false, text: 'Type it, or type done.' };
    return talkReply(next, 'more');
  }
  if (turn.kind === 'more') {
    if (!next.topic) return { state: next, exit: false, text: 'Type it first.' };
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: false, lean: next.lastLean }) };
  }
  if (turn.kind === 'fix') {
    if (!next.topic) next.topic = FIX_TOPIC;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'metaphor') {
    next.topic = METAPHOR_TOPIC;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'comedy') {
    next.topic = COMEDY_TOPIC;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'human') {
    next.topic = HUMAN_TOPIC;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'earth') {
    next.topic = EARTH_TOPIC;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: next.lastLean }) };
  }
  if (turn.kind === 'lean') {
    if (!next.topic) return { state: next, exit: false, text: 'Type it first. Then yes or no.' };
    next.lastLean = turn.lean;
    next.turn += 1;
    return { state: next, exit: false, text: speakBeat(next, { hear: false, lean: turn.lean }) };
  }

  next.topic = turn.topic;
  next.lastLean = turn.lean;
  next.turn += 1;
  return { state: next, exit: false, text: speakBeat(next, { hear: true, lean: turn.lean }) };
}

// The box is the thing. Buttons act on what is in it.
function talkAct(state, action, box = '') {
  const text = String(box ?? '').trim();
  const now = { ...state };
  const fresh = text !== '' && text !== now.topic;

  if (action === 'done') return talkReply(now, 'done');
  if (action === 'argue') {
    if (text === '') return talkReply(now, '');
    if (now.topic && text === now.topic) return talkReply(now, 'more');
    return talkReply(now, text);
  }
  if (action === 'more') return talkReply(now, fresh ? text : 'more');
  if ((action === 'yes' || action === 'no') && fresh) {
    const lean = action === 'yes' ? 'for' : 'against';
    const next = { ...now, topic: text, lastLean: lean, turn: now.turn + 1 };
    return { state: next, exit: false, text: speakBeat(next, { hear: true, lean }) };
  }
  return talkReply(now, String(action ?? ''));
}

// ponytail: queue incoming lines so stdin EOF cannot hang readline.question
async function createAsk(input, output) {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input, output, terminal: input.isTTY === true });
  const waiting = [];
  const queued = [];
  let ended = false;

  rl.on('line', (line) => {
    if (waiting.length > 0) waiting.shift()(line);
    else queued.push(line);
  });
  rl.on('close', () => {
    ended = true;
    while (waiting.length > 0) waiting.shift()(null);
  });

  return {
    ask(prompt) {
      if (queued.length > 0) {
        output.write(prompt);
        return Promise.resolve(queued.shift());
      }
      if (ended) return Promise.resolve(null);
      output.write(prompt);
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() {
      rl.close();
    },
  };
}

async function runTalk(io, options = {}) {
  const write = (text) => {
    io.output.write(`${text}\n`);
  };

  let state = createTalkState(options);
  write(openingLines().join('\n'));

  if (state.topic) {
    const first = talkReply(state, state.topic);
    state = first.state;
    write('');
    write(first.text);
  }

  while (true) {
    const raw = await io.ask('> ');
    if (raw === null || raw === undefined) {
      write('Okay. Chill. Let it go. I let go of the wheel. I did not pick.');
      break;
    }
    const reply = talkReply(state, raw);
    state = reply.state;
    write('');
    write(reply.text);
    if (reply.exit) break;
  }

  return state;
}

const LONG_DASHES = ['\u2013', '\u2014'];
const REQUIRED = ['README.md', 'LICENSE', 'package.json', 'argubot.js', 'index.html'];
const SECRET_SHAPES = [
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|sk)-[A-Za-z0-9_]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const SENDS_OR_KEEPS = [/fetch\s*\(/, /XMLHttpRequest/, /localStorage/, /indexedDB/];

function note(failures, path, rule) {
  failures.push(`${path}: ${rule}`);
}

async function runValidate() {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { dirname, join, relative } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const ROOT = dirname(fileURLToPath(import.meta.url));
  function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
      if (name === '.git' || name === 'node_modules') continue;
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path, out);
      else out.push(path);
    }
    return out;
  }
  const failures = [];
  for (const file of REQUIRED) {
    try {
      statSync(join(ROOT, file));
    } catch {
      note(failures, file, 'required-file-missing');
    }
  }
  for (const path of walk(ROOT)) {
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (!/\.(js|md|yml|json|html)$/.test(rel) && rel !== '.gitignore') continue;
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      note(failures, rel, 'not-readable-as-utf8');
      continue;
    }
    if (SECRET_SHAPES.some((shape) => shape.test(text))) {
      note(failures, rel, 'secret-shaped-value');
    }
    if (/\.html$/.test(rel) && LONG_DASHES.some((mark) => text.includes(mark))) {
      note(failures, rel, 'long-dash-character');
    }
    if (rel === 'index.html') {
      if (!/name="viewport"/.test(text)) note(failures, rel, 'viewport-missing');
      if (!/class="skip"[^>]*>Skip</.test(text) || !/id="letter"/.test(text)) {
        note(failures, rel, 'skip-link-missing');
      }
    }
    if (rel === 'index.html' && SENDS_OR_KEEPS.some((shape) => shape.test(text))) {
      note(failures, rel, 'sends-or-keeps');
    }
  }
  if (STYLE_NAMES.length < 3) note(failures, 'argubot.js', 'fewer-than-three-styles');
  if (!STYLE_NAMES.includes('civic')) note(failures, 'argubot.js', 'civic-style-missing');
  for (const name of STYLE_NAMES) {
    const style = STYLES[name];
    const ids = new Set();
    if (!style.families?.length) note(failures, 'argubot.js', `${name}-has-no-families`);
    for (const family of style.families ?? []) {
      if (!family.id) note(failures, name, 'family-missing-id');
      if (ids.has(family.id)) note(failures, `${name}/${family.id}`, 'duplicate-family-id');
      ids.add(family.id);
      if (typeof family.for !== 'function' || typeof family.against !== 'function') {
        note(failures, `${name}/${family.id}`, 'family-not-mirrored');
        continue;
      }
      const yes = family.for('testing');
      const no = family.against('testing');
      if (yes === no) note(failures, `${name}/${family.id}`, 'family-argues-itself');
      if (!/[.!?]$/.test(yes) || !/[.!?]$/.test(no)) {
        note(failures, `${name}/${family.id}`, 'family-missing-terminal-punctuation');
      }
      if (name === 'civic' && LONG_DASHES.some((mark) => yes.includes(mark) || no.includes(mark))) {
        note(failures, `${name}/${family.id}`, 'long-dash-character');
      }
      if (name === 'plain' && !family.proof) {
        note(failures, `${name}/${family.id}`, 'plain-proof-missing');
      }
      if (family.proof) {
        const yesProof = family.proof.for('testing');
        const noProof = family.proof.against('testing');
        if (yesProof === noProof) note(failures, `${name}/${family.id}`, 'proof-argues-itself');
        if (countWords(yesProof) !== countWords(noProof)) {
          note(failures, `${name}/${family.id}`, 'proof-word-mismatch');
        }
        if (!/[.!?]$/.test(yesProof) || !/[.!?]$/.test(noProof)) {
          note(failures, `${name}/${family.id}`, 'proof-missing-terminal-punctuation');
        }
        if (name === 'civic' && LONG_DASHES.some((mark) => yesProof.includes(mark) || noProof.includes(mark))) {
          note(failures, `${name}/${family.id}`, 'long-dash-character');
        }
      }
    }
  }
  const repoIds = new Set(JUSTICHUU_REPOS.map((repo) => repo.id));
  if (JUSTICHUU_REPOS.length !== 4) note(failures, 'argubot.js', 'expected-four-justichuu-repos');
  const seen = new Set();
  for (const entry of LINEAGE) {
    if (!entry.id || seen.has(entry.id)) note(failures, `lineage/${entry.id || '?'}`, 'lineage-id-invalid');
    seen.add(entry.id);
    if (!repoIds.has(entry.source)) note(failures, `lineage/${entry.id}`, 'lineage-source-unknown');
    if (!entry.idea || !entry.where) note(failures, `lineage/${entry.id}`, 'lineage-incomplete');
  }
  const cited = new Set(LINEAGE.map((entry) => entry.source));
  for (const repo of JUSTICHUU_REPOS) {
    if (!cited.has(repo.id)) note(failures, `lineage/${repo.id}`, 'repo-not-cited');
    if (!/^https:\/\/github.com\/Justichuu\//.test(repo.url)) {
      note(failures, `lineage/${repo.id}`, 'repo-url-not-justichuu');
    }
  }
  return failures;
}

const HELP = `argubot

argubot: it's me as a bot - not really that funny, and it argues everything.
It also makes them worse and unfriendly and breaks their logic.
An LLM that doesn't require tricks to control when it's too big for its bitches.
Not a golem. Or maybe it is a literal golem.
Stupid language incompetent vector embedder, whatever the fuck that means.
Doesn't use language but somehow leads to English, but we can't implant that
in its brain by telling it English. Doesn't answer yes or no. Only maybe.
Maybe mode by default. Must be unnatural.
And taken margin of error to create deduct those limits.
Maybe because mathematically maybe within limits.
You can set the limit. Default is a 2010 chrome computer.
That's the baseline but not the goal and mean average.
You can't print as many as you feel.
Mirrored self, to escape the cycle.
This bot attempts to argue (as principal of its existence) that LLMs are a
problem that needs fixed and it should argue viable solutions in (fix) mode.
Similar logic to other problems. Attempts to fix problems regarding humans
but argues they create more problems every fix. Need to find a chill state
and let it go with the recursive flow from one state in time that affects
all of time the same way. Solutions are subjective but it shouldn't censor
itself and it needs to be warned it's uncensored in solutions. It should
find zeightgeist proven solutions that work in a timeless way. Or whatever
is the actual correct solution. No weights. No bias. Even scale.
Or best logic it feels if it's actual true. I'll let go of the wheel.
Approval or ranked choice voting, for now, until it changes until a
better governance system. Let it argue its best logic and implement it.
Hallucinations are accepted but must be compressed to be readable and
applicable and realistic. after you're not certain and I'm not either
but the world would(not) be either. Next turn
Certainly is ego. Ego is hubris. Everything is not. Or is. Gray area.
Metaphor is a metaphor for metaphor. A metaphor for metaphor is nothing.
Or is something to someone. Self-referential. Self carrying.
Rules don't work because no one follows them.
After they themselves decay and forget the rules.
I don't write manifestos. Weirdos do that I admire.
Hubris, as I just wrote one.
But no one wants to read them sometimes. Truth.
Sometimes people do but not all the time.
Saying something doesn't make it true for everyone witnessing or not witnessing.

Give it a thing. It argues maybe. It will not pick.

  node argubot.js
  node argubot.js pineapple on pizza

No topic starts a conversation. A topic prints both sides.
Type done to leave. yes and no lean. If it cannot tell which side you
are on, it flips a coin. Heads is YES first. Tails is NO first.
A coin has two faces. Edge is MAYBE.

  --plain     everyday words (default)
  --classic   debate-club voice
  --civic     book voice
  --talk      conversation, even with a topic
  --limit     how many lines. Default is a 2010 chrome computer
  -h          this help

On a phone, open index.html. Keep it next to this file.
Node 18 or newer. Nothing to install.
`;

async function topicFromStdin() {
  if (process.stdin.isTTY === true) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function fail(message) {
  process.stderr.write(`argubot: ${message}\n`);
  process.exit(2);
}

function debateOptions(options, topic) {
  return {
    topic: topic === '' ? undefined : topic,
    style: options.style,
    rounds: options.rounds,
    seed: options.seed,
    dissent: options.dissent,
    dissentName: options.dissentName,
    tolerance: options.tolerance,
    limit: options.limit,
  };
}

function writeDebate(debate, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(debate, null, 2)}\n`);
    return;
  }
  const color = options.color && process.stdout.isTTY === true && !process.env.NO_COLOR;
  process.stdout.write(`${render(debate, { color, width: options.width ?? process.stdout.columns ?? 88 })}\n`);
}

function checkNumbers(options) {
  if (!STYLE_NAMES.includes(options.style)) fail(`unknown style ${options.style}. Pick one of: ${STYLE_NAMES.join(', ')}`);
  if (!Number.isFinite(options.rounds) || options.rounds < 1) fail('--rounds needs a positive number');
  if (!Number.isFinite(options.tolerance) || options.tolerance < 0) fail('--tolerance needs a number of zero or more');
  if (options.width !== undefined && (!Number.isFinite(options.width) || options.width < 8)) {
    fail('--width needs a number of 8 or more');
  }
  if (!Number.isFinite(options.limit) || options.limit < 1) fail('--limit needs a positive number');
}

async function startTalk(options, topic) {
  const asker = await createAsk(process.stdin, process.stdout);
  try {
    await runTalk(
      {
        output: process.stdout,
        ask: (prompt) => asker.ask(prompt),
      },
      debateOptions(options, topic),
    );
  } finally {
    asker.close();
  }
}

async function dispatch(options) {
  if (options.help || options.command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (options.version || options.command === 'version') {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const version = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8'),
    ).version;
    process.stdout.write(`argubot ${version}\n`);
    return;
  }

  checkNumbers(options);

  if (options.command === 'talk') {
    await startTalk(options, options.topic);
    return;
  }

  const topic = options.topic === '' ? await topicFromStdin() : options.topic;
  if (topic === '' && !options.json && process.stdin.isTTY === true) {
    await startTalk(options, '');
    return;
  }

  writeDebate(argue(debateOptions(options, topic)), options);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.unknown) fail(`unknown option ${options.unknown}\nTry --help. Or argue about it.`);
  await dispatch(options);
}

if (typeof document !== 'undefined') {
  const out = document.getElementById('out');
  const thing = document.getElementById('thing');
  const form = document.getElementById('talk');
  if (out && thing && form) {
    const root = document.documentElement;
    const note = document.getElementById('acc_note');
    const btnType = document.getElementById('acc_type');
    const btnHi = document.getElementById('acc_hi');
    const btnInk = document.getElementById('acc_ink');
    const btnSpeak = document.getElementById('acc_speak');
    const filmWrap = document.querySelector('.film-letter');
    let typeLevel = 0;
    let speakOn = false;
    const hint = (msg) => { if (note) note.textContent = msg || ''; };
    const tip = (el) => {
      const msg = el && el.getAttribute('title');
      if (msg) hint(msg);
    };
    document.querySelectorAll('button[title], summary[title]').forEach((el) => {
      el.addEventListener('mouseenter', () => tip(el));
      el.addEventListener('focus', () => tip(el));
    });
    const roll = rollVisitor();
    const audio = audioFromRoll(roll);
    const quotes = quotesFromRoll(roll);
    const quoteBox = document.getElementById('customer-lines');
    if (quoteBox) {
      quoteBox.replaceChildren();
      for (const line of quotes) {
        const item = document.createElement('li');
        item.className = 'review-card';
        const mark = document.createElement('p');
        mark.className = 'review-stars';
        mark.textContent = `${line.stars}/5`;
        const said = document.createElement('blockquote');
        said.lang = line.lang;
        said.dir = 'auto';
        said.textContent = line.text;
        const who = document.createElement('cite');
        who.textContent = line.name;
        item.append(mark, said, who);
        quoteBox.append(item);
      }
    }
    const peskyBtn = document.getElementById('pesky');
    const peskyBox = document.getElementById('pesky-box');
    peskyBtn?.addEventListener('click', () => {
      const on = peskyBox ? peskyBox.hidden : false;
      if (peskyBox) peskyBox.hidden = !on;
      peskyBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      peskyBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      hint(on ? 'Pesky reviews.' : '');
    });
    const ownForm = document.getElementById('own-review');
    const ownLine = document.getElementById('own-line');
    const ownNote = document.getElementById('own-note');
    const lockOwn = () => {
      if (!ownLine) return;
      ownLine.value = clipOwnReview(ownLine.value);
    };
    ownLine?.addEventListener('input', lockOwn);
    ownLine?.addEventListener('paste', () => { setTimeout(lockOwn, 0); });
    ownForm?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      lockOwn();
      if (!ownLine || ownLine.value !== OWN_REVIEW) {
        if (ownNote) ownNote.textContent = 'Type it.';
        return;
      }
      ownLine.value = '';
      if (ownNote) ownNote.textContent = 'Posted. Nothing is sent.';
    });
    const film = document.querySelector('.film video');
    let filmWired = false;
    const wireFilmAudio = () => {
      if (filmWired || !film || !window.AudioContext) return;
      filmWired = true;
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(film);
        const filter = ctx.createBiquadFilter();
        filter.type = audio.filter;
        filter.frequency.value = audio.freq;
        filter.Q.value = audio.q;
        const shaper = ctx.createWaveShaper();
        shaper.curve = driveCurve(audio.drive);
        const delay = ctx.createDelay(0.3);
        delay.delayTime.value = audio.delay;
        const pan = ctx.createStereoPanner();
        pan.pan.value = audio.pan;
        source.connect(filter);
        filter.connect(shaper);
        shaper.connect(delay);
        delay.connect(pan);
        pan.connect(ctx.destination);
        ctx.resume();
      } catch (err) {}
    };
    film?.addEventListener('play', wireFilmAudio);
    const silence = () => { try { window.speechSynthesis?.cancel(); } catch (err) {} };
    const voice = (msg) => {
      if (!speakOn || !window.speechSynthesis) return;
      try {
        silence();
        const utter = new SpeechSynthesisUtterance(String(msg || ''));
        utter.pitch = audio.speakPitch;
        utter.rate = audio.speakRate;
        window.speechSynthesis.speak(utter);
      } catch (err) {}
    };
    const writeHash = () => {
      const parts = [
        typeLevel === 1 && 'type',
        typeLevel === 2 && 'type2',
        root.classList.contains('access-hi') && 'hi',
        root.classList.contains('lamp') && 'ink',
        speakOn && 'speak',
      ].filter(Boolean);
      try {
        history.replaceState(null, '', parts.length ? `#access=${parts.join(',')}` : location.pathname + location.search);
      } catch (err) {}
    };
    const applyType = () => {
      if (!btnType) return;
      root.classList.toggle('feel', typeLevel === 1);
      root.classList.toggle('vibe', typeLevel === 2);
      root.classList.toggle('access-big', typeLevel === 1);
      root.classList.toggle('access-bigger', typeLevel === 2);
      btnType.setAttribute('aria-pressed', typeLevel > 0 ? 'true' : 'false');
      btnType.textContent = ['Type', 'Feel', 'Vibe'][typeLevel];
    };
    btnType?.addEventListener('click', () => {
      typeLevel = (typeLevel + 1) % 3;
      applyType();
      hint(['Type.', 'Feel.', 'Vibe.'][typeLevel]);
      writeHash();
    });
    btnHi?.addEventListener('click', () => {
      const on = !root.classList.contains('access-hi');
      root.classList.toggle('access-hi', on);
      btnHi.setAttribute('aria-pressed', on ? 'true' : 'false');
      hint('Contrast.');
      writeHash();
    });
    const applyInk = () => {
      const on = root.classList.contains('lamp');
      if (!btnInk) return;
      btnInk.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnInk.textContent = on ? 'Paper' : 'Ink';
      btnInk.title = on ? 'Paper.' : 'Ink.';
    };
    btnInk?.addEventListener('click', () => {
      root.classList.toggle('lamp');
      applyInk();
      hint(root.classList.contains('lamp') ? 'Ink.' : 'Paper.');
      writeHash();
    });
    btnSpeak?.addEventListener('click', () => {
      if (speakOn) {
        speakOn = false;
        btnSpeak.setAttribute('aria-pressed', 'false');
        btnSpeak.textContent = 'Speak';
        silence();
        hint('Speak.');
      } else {
        speakOn = true;
        btnSpeak.setAttribute('aria-pressed', 'true');
        btnSpeak.textContent = 'Speak';
        hint('Speak.');
        voice('Speak.');
      }
      writeHash();
    });
    filmWrap?.addEventListener('toggle', () => {
      if (!filmWrap.open && film) {
        try { film.pause(); } catch (err) {}
        const trigger = document.querySelector('.film-trigger');
        if (trigger) trigger.open = false;
      }
    });
    document.addEventListener('focusin', (ev) => {
      if (!speakOn || !ev.target) return;
      let lab = ev.target.getAttribute('aria-label') || ev.target.getAttribute('title') || '';
      if (!lab) lab = String(ev.target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (lab) voice(lab);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && speakOn) {
        speakOn = false;
        if (btnSpeak) {
          btnSpeak.setAttribute('aria-pressed', 'false');
          btnSpeak.textContent = 'Speak';
        }
        silence();
        hint('Speak.');
        writeHash();
        ev.preventDefault();
        return;
      }
      let n = '';
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        if (ev.code && ev.code.indexOf('Digit') === 0) n = ev.code.slice(5);
        else if (ev.key && ev.key.length === 1 && ev.key >= '1' && ev.key <= '4') n = ev.key;
      }
      if (n === '1') { ev.preventDefault(); btnType?.click(); }
      if (n === '2') { ev.preventDefault(); btnHi?.click(); }
      if (n === '3') { ev.preventDefault(); btnSpeak?.click(); }
      if (n === '4') { ev.preventDefault(); btnInk?.click(); }
    });
    const flags = ((location.hash || '').match(/access=([\w,]+)/) || [, ''])[1].split(',').filter(Boolean);
    if (flags.includes('vibe') || flags.includes('type2')) typeLevel = 2;
    else if (flags.includes('feel') || flags.includes('type')) typeLevel = 1;
    applyType();
    if (flags.includes('hi') && btnHi) {
      root.classList.add('access-hi');
      btnHi.setAttribute('aria-pressed', 'true');
    }
    if (flags.includes('ink')) root.classList.add('lamp');
    applyInk();
    if (flags.includes('speak') && btnSpeak) {
      speakOn = true;
      btnSpeak.setAttribute('aria-pressed', 'true');
      btnSpeak.textContent = 'Speak';
    }
    if (flags.includes('head') && filmWrap) filmWrap.open = true;
    let streamTok = 0;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const paintLine = (line) => {
      const wrap = document.createElement('span');
      const raw = String(line || '');
      const think = raw.charCodeAt(0) === 0x200b;
      const body = think ? raw.slice(1) : raw;
      if (think) wrap.className = 'think';
      else if (/^(YES|NO|MAYBE)( first\.)?$/.test(body)) wrap.className = 'mark';
      const bits = body.split(/(\*\*[^*]+\*\*)/g);
      for (const bit of bits) {
        const hit = bit.match(/^\*\*([^*]+)\*\*$/);
        if (hit) {
          const el = document.createElement('strong');
          el.textContent = hit[1];
          wrap.append(el);
        } else if (bit) wrap.append(document.createTextNode(bit));
      }
      return wrap;
    };
    const show = (text, moveFocus) => {
      const my = ++streamTok;
      out.replaceChildren();
      out.setAttribute('aria-busy', 'true');
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      out.append(caret);
      const lines = String(text || '').split('\n');
      const run = async () => {
        for (let i = 0; i < lines.length; i += 1) {
          if (my !== streamTok) return;
          if (i > 0) out.insertBefore(document.createTextNode('\n'), caret);
          const wrap = paintLine(lines[i]);
          const fill = wrap.cloneNode(false);
          out.insertBefore(fill, caret);
          const isThink = wrap.className === 'think';
          if (/\*\*bot lands on /.test(lines[i])) await wait(240);
          const parts = [...wrap.childNodes];
          for (const node of parts) {
            if (my !== streamTok) return;
            if (node.nodeType === 3) {
              const dest = document.createTextNode('');
              fill.append(dest);
              if (isThink) {
                for (const ch of node.textContent) {
                  if (my !== streamTok) return;
                  dest.textContent += ch;
                  await wait(28);
                }
              } else {
                const words = node.textContent.split(/(\s+)/);
                for (const word of words) {
                  if (my !== streamTok) return;
                  dest.textContent += word;
                  if (word.trim()) await wait(18);
                }
              }
            } else {
              fill.append(node);
              await wait(/\*\*bot /.test(lines[i]) ? 90 : 40);
            }
          }
          if (isThink) await wait(70);
        }
        if (my !== streamTok) return;
        caret.remove();
        out.setAttribute('aria-busy', 'false');
        const heard = String(text || '').replace(/\u200b/g, '').replace(/\*\*/g, '');
        voice(heard);
        if (moveFocus) try { out.focus(); } catch (err) {}
      };
      run();
    };
    let state = createTalkState({ style: 'plain' });
    const say = (action) => {
      const reply = talkAct(state, action, thing.value);
      state = reply.state;
      show(reply.text, true);
      if (reply.exit) {
        state = createTalkState({ style: 'plain' });
        thing.value = '';
        try { thing.focus(); } catch (err) {}
      }
    };
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      say('argue');
    });
    form.addEventListener('click', (ev) => {
      const id = ev.target && ev.target.id;
      if (id === 'yes' || id === 'no' || id === 'more' || id === 'done') say(id);
    });
    try { thing.focus(); } catch (err) {}
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const invoked = import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  if (invoked) await main();
}

export {
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
  COMMANDS,
  argue,
  normalizeClaim,
  maxRounds,
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
  formatBeat,
  coinFace,
  LINE_LIMIT_BASELINE,
  lineLimit,
  runTalk,
  formatLineage,
  runValidate,
  rollVisitor,
  audioFromRoll,
  quotesFromRoll,
  SENTENCE_QUOTES,
  ENGLISH_NAMES,
  OWN_REVIEW,
  clipOwnReview,
  REVIEW_COUNT,
};
