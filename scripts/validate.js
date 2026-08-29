#!/usr/bin/env node
// Structural checks borrowed from the book's validate.py: report the file and
// the failed rule, never a suspected secret. No third-party dependencies.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STYLES, STYLE_NAMES } from '../src/styles.js';
import { JUSTICHUU_REPOS, LINEAGE } from '../src/lineage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LONG_DASHES = ['\u2013', '\u2014'];
const REQUIRED = [
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'LINEAGE.md',
  'ACKNOWLEDGMENTS.md',
  'package.json',
  'bin/argubot.js',
  'src/argubot.js',
  'src/styles.js',
  'src/rhetoric.js',
  'src/plain.js',
  'src/civic.js',
  'src/audit.js',
  'src/lineage.js',
  'src/talk.js',
  'src/rng.js',
  'src/render.js',
  'scripts/validate.js',
  'test/argubot.test.js',
];

const SECRET_SHAPES = [
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|sk)-[A-Za-z0-9_]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

const CREDENTIAL_BOAST = /\b(PhD|M\.D\.|official study|peer-reviewed consensus I just invented)\b/i;

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

function fail(failures, path, rule) {
  failures.push(`${path}: ${rule}`);
}

function validateInventory(failures) {
  for (const file of REQUIRED) {
    try {
      statSync(join(ROOT, file));
    } catch {
      fail(failures, file, 'required-file-missing');
    }
  }
}

function validateTextFiles(failures) {
  const civicRoot = join(ROOT, 'src', 'civic.js');
  for (const path of walk(ROOT)) {
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (!/\.(js|md|yml|json)$/.test(rel) && rel !== '.gitignore') continue;
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      fail(failures, rel, 'not-readable-as-utf8');
      continue;
    }
    if (rel === 'src/civic.js' || rel === 'LINEAGE.md' || rel === 'scripts/validate.js') {
      if (LONG_DASHES.some((mark) => text.includes(mark))) fail(failures, rel, 'long-dash-character');
    }
    if (path === civicRoot && CREDENTIAL_BOAST.test(text)) {
      fail(failures, rel, 'invented-credential');
    }
    if (rel !== 'scripts/validate.js' && SECRET_SHAPES.some((shape) => shape.test(text))) {
      fail(failures, rel, 'secret-shaped-value');
    }
  }
}

function validateStyles(failures) {
  if (STYLE_NAMES.length < 3) fail(failures, 'src/styles.js', 'fewer-than-three-styles');
  if (!STYLE_NAMES.includes('civic')) fail(failures, 'src/styles.js', 'civic-style-missing');

  for (const name of STYLE_NAMES) {
    const style = STYLES[name];
    const ids = new Set();
    if (!style.families?.length) fail(failures, `src/styles.js`, `${name}-has-no-families`);
    for (const family of style.families ?? []) {
      if (!family.id) fail(failures, name, 'family-missing-id');
      if (ids.has(family.id)) fail(failures, `${name}/${family.id}`, 'duplicate-family-id');
      ids.add(family.id);
      if (typeof family.for !== 'function' || typeof family.against !== 'function') {
        fail(failures, `${name}/${family.id}`, 'family-not-mirrored');
        continue;
      }
      const yes = family.for('testing');
      const no = family.against('testing');
      if (yes === no) fail(failures, `${name}/${family.id}`, 'family-argues-itself');
      if (!/[.!?]$/.test(yes) || !/[.!?]$/.test(no)) {
        fail(failures, `${name}/${family.id}`, 'family-missing-terminal-punctuation');
      }
      if (name === 'civic' && LONG_DASHES.some((mark) => yes.includes(mark) || no.includes(mark))) {
        fail(failures, `${name}/${family.id}`, 'long-dash-character');
      }
    }
  }
}

function validateLineage(failures) {
  const repoIds = new Set(JUSTICHUU_REPOS.map((repo) => repo.id));
  if (JUSTICHUU_REPOS.length !== 4) fail(failures, 'src/lineage.js', 'expected-four-justichuu-repos');
  const seen = new Set();
  for (const entry of LINEAGE) {
    if (!entry.id || seen.has(entry.id)) fail(failures, `lineage/${entry.id || '?'}`, 'lineage-id-invalid');
    seen.add(entry.id);
    if (!repoIds.has(entry.source)) fail(failures, `lineage/${entry.id}`, 'lineage-source-unknown');
    if (!entry.idea || !entry.where) fail(failures, `lineage/${entry.id}`, 'lineage-incomplete');
  }
  const cited = new Set(LINEAGE.map((entry) => entry.source));
  for (const repo of JUSTICHUU_REPOS) {
    if (!cited.has(repo.id)) fail(failures, `lineage/${repo.id}`, 'repo-not-cited');
    if (!/^https:\/\/github.com\/Justichuu\//.test(repo.url)) {
      fail(failures, `lineage/${repo.id}`, 'repo-url-not-justichuu');
    }
  }
}

function report(failures) {
  if (failures.length > 0) {
    process.stdout.write('argubot validation failed:\n');
    for (const item of failures) process.stdout.write(`- ${item}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `argubot validation passed (${STYLE_NAMES.length} styles, ${LINEAGE.length} lineage entries).\n`,
  );
}

const failures = [];
validateInventory(failures);
validateTextFiles(failures);
validateStyles(failures);
validateLineage(failures);
report(failures);
