// Named catalog: id, source, idea, where. Not a list of credentials.

export const JUSTICHUU_REPOS = [
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

export const LINEAGE = [
  {
    id: 'mirrored-pairs',
    idea: 'Every argument ships as a matched for-and-against pair.',
    source: 'argubot',
    where: 'src/rhetoric.js, src/plain.js, src/civic.js',
  },
  {
    id: 'fairness-by-construction',
    idea: 'Neutrality is structural: the bot has no unpaired ammunition.',
    source: 'argubot',
    where: 'src/argubot.js, src/audit.js',
  },
  {
    id: 'no-verdict',
    idea: 'The program is not allowed to pick a winner, and a test asserts that.',
    source: 'argubot',
    where: 'src/rhetoric.js VERDICT_LINES, test/argubot.test.js',
  },
  {
    id: 'civic-voice',
    idea: 'A third style speaks in the book\'s public-draft cadence.',
    source: 'book',
    where: 'src/civic.js',
  },
  {
    id: 'no-long-dash',
    idea: 'The civic voice and the validator refuse en-dashes and em-dashes.',
    source: 'book',
    where: 'scripts/validate.js, src/civic.js',
  },
  {
    id: 'no-invented-credentials',
    idea: 'Civic lines may not invent degrees, studies, or official approval.',
    source: 'book',
    where: 'src/civic.js, test/argubot.test.js',
  },
  {
    id: 'evidence-over-claims',
    idea: 'A fluent sentence is not evidence. Word counts and tests are.',
    source: 'directory',
    where: 'src/audit.js, scripts/validate.js',
  },
  {
    id: 'honest-authorship',
    idea: 'Human direction and AI assistance are both named, not hidden.',
    source: 'directory',
    where: 'ACKNOWLEDGMENTS.md',
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
    where: 'src/lineage.js, LINEAGE.md',
  },
  {
    id: 'validator-reports-rules',
    idea: 'The validator names the failed rule, never the suspected secret.',
    source: 'book',
    where: 'scripts/validate.js',
  },
  {
    id: 'reviewable-record',
    idea: 'A contribution is a record somebody can review, not a particular tool.',
    source: 'argubot',
    where: 'CONTRIBUTING.md, https://github.com/Justichuu/argubot/pull/6',
  },
];

export function formatLineage() {
  const repos = JUSTICHUU_REPOS.map((repo) => `  ${repo.id.padEnd(10)} ${repo.url}\n             ${repo.role}`).join(
    '\n',
  );
  const entries = LINEAGE.map((entry) => `  ${entry.id}\n    ${entry.idea}\n    from ${entry.source} · ${entry.where}`).join(
    '\n',
  );
  return `argubot lineage\n\nJustichuu repos this work is reading:\n${repos}\n\nNamed ideas you can check:\n${entries}\n`;
}
