#!/usr/bin/env node
// Victor. Overlap is not a vector. A hashed bag is a vector and still not meaning.

function tokens(s) {
  return String(s).toLowerCase().match(/[a-z0-9]+/g) || [];
}

function overlap(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  const denom = Math.max(1, A.size, B.size);
  return hit / denom;
}

const DIM = 64;

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function ngrams(s, n) {
  const t = ` ${String(s).toLowerCase()} `;
  const out = [];
  for (let i = 0; i <= t.length - n; i += 1) out.push(t.slice(i, i + n));
  return out;
}

function hashEmbed(s) {
  const v = new Float64Array(DIM);
  for (const g of ngrams(s, 3)) {
    const h = fnv(g);
    v[h % DIM] += (h & 1) === 0 ? 1 : -1;
  }
  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i += 1) v[i] /= norm;
  return v;
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

const left = process.argv[2] ?? "cars is a fix";
const right = process.argv[3] ?? "cars makes more problems";
const ov = overlap(left, right);
const cos = cosine(hashEmbed(left), hashEmbed(right));

process.stdout.write(`left:    ${left}\n`);
process.stdout.write(`right:   ${right}\n`);
process.stdout.write(`overlap: ${ov.toFixed(4)}   (shared tokens / max size)\n`);
process.stdout.write(`hashed:  ${cos.toFixed(4)}   (cosine of 64-d hashed 3-grams)\n`);
process.stdout.write("hashed is a vector. It is not a model. Near here means shared pieces.\n");
