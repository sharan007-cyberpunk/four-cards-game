import {useCallback, useEffect, useRef, useState} from 'react';

const KEY = 'fourcards-sfx-enabled';

function readEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function useGameSounds({state, privateState, room, onError}) {
  const [enabled, setEnabled] = useState(readEnabled);
  const ctxRef = useRef(null);
  const prevRef = useRef({phase:null, turn:null, round:null, players:[], hand:[], joker:null, message:null});

  const ensureContext = useCallback(() => {
    if (!enabled) return null;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
      return ctxRef.current;
    } catch {
      onError?.('Game sound is unavailable in this browser.');
      return null;
    }
  }, [enabled, onError]);

  const setSoundEnabled = useCallback((next) => {
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch {}
    if (next) ensureContext();
  }, [ensureContext]);

  const tone = useCallback((notes, duration=0.12, type='sine', volume=0.045, gap=0.025) => {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + i * gap);
      gain.gain.setValueAtTime(0.0001, now + i * gap);
      gain.gain.exponentialRampToValueAtTime(volume, now + i * gap + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * gap + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * gap);
      osc.stop(now + i * gap + duration + 0.02);
    });
  }, [ensureContext]);

  const play = useCallback((name) => {
    if (!enabled) return;
    switch (name) {
      case 'card': tone([220, 330], .09, 'triangle', .035, .018); break;
      case 'draw': tone([330, 440], .11, 'triangle', .04, .025); break;
      case 'take': tone([392, 523], .12, 'sine', .04, .025); break;
      case 'turn': tone([659, 784], .16, 'sine', .04, .04); break;
      case 'joker': tone([523, 659, 784, 1047], .18, 'sine', .045, .035); break;
      case 'open': tone([392, 494, 659], .18, 'triangle', .045, .035); break;
      case 'error': tone([180, 140], .18, 'sawtooth', .035, .035); break;
      case 'round': tone([523, 659, 784], .2, 'sine', .045, .045); break;
      case 'win': tone([523, 659, 784, 1047], .25, 'triangle', .05, .05); break;
      case 'join': tone([440, 554], .12, 'sine', .03, .03); break;
      case 'leave': tone([554, 440], .12, 'sine', .025, .03); break;
      case 'warning': tone([740, 740], .1, 'square', .025, .06); break;
      default: break;
    }
  }, [enabled, tone]);

  useEffect(() => {
    if (!state) return;
    const prev = prevRef.current;
    const hand = privateState?.hand || [];
    const ids = (state.players || []).map(p => p.id).sort();

    if (prev.round !== null && state.roundNumber !== prev.round) play('round');
    if (prev.turn && state.currentPlayerId === room.playerId && prev.turn !== room.playerId) play('turn');
    if (prev.phase !== state.phase) {
      if (state.phase === 'OPEN_CONFIRMATION') play('open');
      if (state.phase === 'ROUND_RESULT') play(state.roundWinnerName ? 'round' : 'error');
      if (state.phase === 'GAME_OVER') play('win');
    }
    if (prev.joker !== null && state.jokerCard?.code && state.jokerCard.code !== prev.joker) play('joker');
    if (prev.players.length) {
      const prevSet = new Set(prev.players);
      const joined = ids.some(id => !prevSet.has(id));
      const left = prev.players.some(id => !ids.includes(id));
      if (joined) play('join');
      else if (left) play('leave');
    }

    prevRef.current = {
      phase: state.phase,
      turn: state.currentPlayerId,
      round: state.roundNumber,
      players: ids,
      hand: hand.map(c => c.code),
      joker: state.jokerCard?.code || null,
      message: state.message
    };
  }, [state, privateState?.hand, room.playerId, play]);

  useEffect(() => () => {
    ctxRef.current?.close?.().catch?.(() => {});
    ctxRef.current = null;
  }, []);

  return {enabled, setEnabled: setSoundEnabled, play};
}
