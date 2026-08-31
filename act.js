// The box is the thing. Buttons act on what is in it.

import { argue, createTalkState, formatBeat, talkReply } from './argubot.js';

function pair(state) {
  return argue({
    topic: state.topic,
    style: state.style,
    rounds: 1,
    seed: state.seed === undefined ? `talk-${state.turn}` : `${state.seed}:${state.turn}`,
    dissent: state.dissent,
    dissentName: state.dissentName,
    tolerance: state.tolerance,
  });
}

export function talkAct(state, action, box = '') {
  const text = String(box ?? '').trim();
  const now = { ...state };
  const fresh = text !== '' && text !== now.topic;

  if (action === 'done') return talkReply(now, 'done');

  if (action === 'argue') {
    if (text === '') return talkReply(now, '');
    if (now.topic && text === now.topic) return talkReply(now, 'more');
    return talkReply(now, text);
  }

  if (action === 'more') {
    if (fresh || (!now.topic && text)) return talkReply(now, text);
    return talkReply(now, 'more');
  }

  if (action === 'yes' || action === 'no') {
    if (fresh || (!now.topic && text)) {
      const lean = action === 'yes' ? 'for' : 'against';
      const next = { ...now, topic: text, lastLean: lean, turn: now.turn + 1 };
      return { state: next, exit: false, text: formatBeat(pair(next), { hear: true, lean }) };
    }
    return talkReply(now, action);
  }

  return talkReply(now, String(action ?? ''));
}

function boot() {
  const out = document.getElementById('out');
  const thing = document.getElementById('thing');
  const form = document.getElementById('talk');
  if (!out || !thing || !form) return;

  const root = document.documentElement;
  const note = document.getElementById('acc_note');
  const btnType = document.getElementById('acc_type');
  const btnHi = document.getElementById('acc_hi');
  const btnSpeak = document.getElementById('acc_speak');

  let typeLevel = 0;
  let speakOn = false;
  let state = createTalkState({ style: 'plain' });

  function hint(msg) {
    if (note) note.textContent = msg || '';
  }

  function silence() {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (err) {}
  }

  function voice(msg) {
    if (!speakOn || !window.speechSynthesis) return;
    try {
      silence();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(String(msg || '')));
    } catch (err) {}
  }

  function writeHash() {
    const parts = [];
    if (typeLevel === 1) parts.push('type');
    if (typeLevel === 2) parts.push('type2');
    if (root.classList.contains('access-hi')) parts.push('hi');
    if (speakOn) parts.push('speak');
    const hash = parts.length ? 'access=' + parts.join(',') : '';
    try {
      history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
    } catch (err) {}
  }

  function applyType() {
    if (!btnType) return;
    root.classList.toggle('access-big', typeLevel === 1);
    root.classList.toggle('access-bigger', typeLevel === 2);
    btnType.setAttribute('aria-pressed', typeLevel > 0 ? 'true' : 'false');
    btnType.textContent = typeLevel === 0 ? 'Type' : typeLevel === 1 ? 'Type +' : 'Type ++';
  }

  if (btnType) {
    btnType.addEventListener('click', () => {
      typeLevel = (typeLevel + 1) % 3;
      applyType();
      hint(typeLevel === 0 ? 'Usual type.' : typeLevel === 1 ? 'Larger type.' : 'Largest type.');
      writeHash();
    });
  }
  if (btnHi) {
    btnHi.addEventListener('click', () => {
      const on = !root.classList.contains('access-hi');
      root.classList.toggle('access-hi', on);
      btnHi.setAttribute('aria-pressed', on ? 'true' : 'false');
      hint(on ? 'High contrast.' : 'Usual contrast.');
      writeHash();
    });
  }
  if (btnSpeak) {
    btnSpeak.addEventListener('click', () => {
      if (speakOn) {
        speakOn = false;
        btnSpeak.setAttribute('aria-pressed', 'false');
        btnSpeak.textContent = 'Speak';
        silence();
        hint('Speak is off.');
        writeHash();
        return;
      }
      speakOn = true;
      btnSpeak.setAttribute('aria-pressed', 'true');
      btnSpeak.textContent = 'Stop speak';
      const msg = 'Type, contrast, and speak on this page. This page will not hear you.';
      hint(msg);
      voice(msg);
      writeHash();
    });
  }

  const flags = ((location.hash || '').match(/access=([\w,]+)/) || [, ''])[1].split(',').filter(Boolean);
  if (flags.includes('type2')) typeLevel = 2;
  else if (flags.includes('type')) typeLevel = 1;
  applyType();
  if (flags.includes('hi') && btnHi) {
    root.classList.add('access-hi');
    btnHi.setAttribute('aria-pressed', 'true');
  }
  if (flags.includes('speak') && btnSpeak) {
    speakOn = true;
    btnSpeak.setAttribute('aria-pressed', 'true');
    btnSpeak.textContent = 'Stop speak';
  }

  function styleNow() {
    const picked = document.querySelector('input[name="style"]:checked');
    return picked ? picked.value : 'plain';
  }

  function show(text, moveFocus) {
    out.textContent = text;
    voice(text);
    if (moveFocus) {
      try { out.focus(); } catch (err) {}
    }
  }

  state = createTalkState({ style: styleNow() });
  show('Say a thing. I will argue both sides and I will not pick.\nDone when you want out. That always works.', false);

  function say(action) {
    state = { ...state, style: styleNow() };
    const reply = talkAct(state, action, thing.value);
    state = reply.state;
    show(reply.text, true);
    if (reply.exit) {
      state = createTalkState({ style: styleNow() });
      thing.value = '';
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    say('argue');
  });
  document.getElementById('yes')?.addEventListener('click', () => say('yes'));
  document.getElementById('no')?.addEventListener('click', () => say('no'));
  document.getElementById('more')?.addEventListener('click', () => say('more'));
  document.getElementById('done')?.addEventListener('click', () => say('done'));
  for (const radio of document.querySelectorAll('input[name="style"]')) {
    radio.addEventListener('change', () => {
      state = { ...state, style: styleNow() };
    });
  }
}

if (typeof document !== 'undefined') boot();
