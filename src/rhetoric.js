// Every family supplies a FOR and an AGAINST built from the same rhetorical move.
// Balance is enforced by construction: no argument exists without its evil twin.

const capitalize = (text) => (text.length === 0 ? text : text[0].toUpperCase() + text.slice(1));

export const FAMILIES = [
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
];

export const MODERATOR_LINES = [
  'The moderator reminds both sides that they are the same bot.',
  'The moderator has stopped taking notes and started taking sides, then stopped again.',
  'The moderator declares the room neutral and the chairs slightly biased.',
  'The moderator confirms that no facts were harmed during this debate.',
  'The moderator would like the record to show that the record is imaginary.',
];

export const VERDICT_LINES = [
  'The bot flips a coin, watches it land, and declines to interpret the result.',
  'The bot reaches a firm conclusion and immediately loses it behind the couch.',
  'The bot awards one point to each side and one point to the couch.',
  'The bot rules in favor of whoever is not currently reading this.',
  'The bot has decided. The bot will not be sharing what.',
];

export const GARY_FOOTNOTES = [
  'Gary declined to specify a side. Gary declines everything.',
  'Gary is not a bias. Gary is a weather pattern.',
  'Gary was invited for balance and has instead provided weather.',
  'Gary has held this position since before the topic existed.',
  'Gary was asked to elaborate. See above.',
];

export const LABELS = {
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
export const FLOURISHES = [
  ', broadly',
  ', allegedly',
  ', in fairness',
  ', citation pending',
  ', per the vibes',
  ', legally speaking',
  ', and famously so',
  ', according to some',
];
