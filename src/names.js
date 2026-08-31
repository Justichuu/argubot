// Consonant + vowel-sound names. Same seed, same name. Not a fixed person.

import { pick } from './rng.js';

const CONSONANTS = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'ei', 'oa', 'oo'];

function capitalize(text) {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function generateName(rng, syllables) {
  const count = syllables ?? 2 + (rng() < 0.35 ? 1 : 0);
  let name = '';
  for (let i = 0; i < count; i += 1) {
    name += pick(rng, CONSONANTS) + pick(rng, VOWELS);
  }
  return capitalize(name);
}

export function personalize(text, name) {
  if (!name) return text;
  return String(text).replace(/Gary/g, name);
}
