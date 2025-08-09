import { useEffect, useMemo, useRef, useState } from 'react';

export interface MetronomeOptions {
  bpm: number; // 10-240
  subdivisions: number; // 1,2,4
  accentEvery: number; // accent every N beats
  volume: number; // 0..1 master
  accentVolume: number; // 0..1
  mute: boolean;
  reducedMotion?: boolean;
}

export interface MetronomeControls {
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  tap: () => void;
  setBpm: (bpm: number) => void;
  setSubdivisions: (n: number) => void;
  setAccentEvery: (n: number) => void;
  setMute: (m: boolean) => void;
  playAccentOnce: () => void;
}

export interface MetronomeState {
  beatCount: number; // total beats elapsed
  isAccent: boolean;
  lastTickAt: number; // audioContext.currentTime seconds
  visualPulseFlag: number; // increments each tick
}

function createClickBuffer(ctx: AudioContext, type: 'tick' | 'accent') {
  const duration = type === 'accent' ? 0.08 : 0.04; // seconds
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const freq = type === 'accent' ? 1400 : 900;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * (type === 'accent' ? 60 : 80)); // gentle ADSR-ish decay
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
  }
  return buffer;
}

export function useMetronome(initial: Partial<MetronomeOptions> = {}): [MetronomeState, MetronomeControls, MetronomeOptions] {
  const [options, setOptions] = useState<MetronomeOptions>({
    bpm: initial.bpm ?? 20,
    subdivisions: initial.subdivisions ?? 1,
    accentEvery: initial.accentEvery ?? 4,
    volume: 0.6,
    accentVolume: 0.8,
    mute: initial.mute ?? false,
    reducedMotion: initial.reducedMotion ?? false,
  });
  const [state, setState] = useState<MetronomeState>({ beatCount: 0, isAccent: false, lastTickAt: 0, visualPulseFlag: 0 });

  const audioRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const tickBufferRef = useRef<AudioBuffer | null>(null);
  const accentBufferRef = useRef<AudioBuffer | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextTickTimeRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);
  const tapHistoryRef = useRef<number[]>([]);

  // Create / resume audio context lazily
  const ensureAudio = () => {
    if (!audioRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = options.volume;
      masterGainRef.current.connect(ctx.destination);
      tickBufferRef.current = createClickBuffer(ctx, 'tick');
      accentBufferRef.current = createClickBuffer(ctx, 'accent');
    }
    return audioRef.current!;
  };

  const scheduleTick = (time: number, isAccent: boolean) => {
    if (!audioRef.current || !masterGainRef.current) return;
    if (!tickBufferRef.current || !accentBufferRef.current) return;
    if (options.mute) return;
    const source = audioRef.current.createBufferSource();
    source.buffer = isAccent ? accentBufferRef.current : tickBufferRef.current;
    const gain = audioRef.current.createGain();
    gain.gain.value = isAccent ? options.accentVolume : options.volume;
    source.connect(gain).connect(masterGainRef.current);
    source.start(time);
  };

  // High-precision scheduler
  const scheduler = () => {
    if (!runningRef.current || !audioRef.current) return;
    const ctxTime = audioRef.current.currentTime;
    const secondsPerBeat = 60 / Math.max(10, Math.min(240, options.bpm)) / Math.max(1, options.subdivisions);
    while (nextTickTimeRef.current < ctxTime + 0.1) { // schedule 100ms ahead
      const nextBeatCount = state.beatCount + 1;
      const isAccent = (nextBeatCount % (options.accentEvery * options.subdivisions)) === 0;
      scheduleTick(nextTickTimeRef.current, isAccent);
      setState(prev => ({
        beatCount: prev.beatCount + 1,
        isAccent,
        lastTickAt: nextTickTimeRef.current,
        visualPulseFlag: prev.visualPulseFlag + 1,
      }));
      nextTickTimeRef.current += secondsPerBeat;
    }
    rafRef.current = requestAnimationFrame(scheduler);
  };

  const start = () => {
    if (runningRef.current) return;
    const ctx = ensureAudio();
    if (ctx.state === 'suspended') ctx.resume();
    runningRef.current = true;
    const now = ctx.currentTime;
    nextTickTimeRef.current = now + 0.5; // first tick eased-in after ~500ms
    rafRef.current = requestAnimationFrame(scheduler);
  };

  const stop = () => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const setBpm = (bpm: number) => setOptions(o => ({ ...o, bpm: Math.max(10, Math.min(240, Math.round(bpm))) }));
  const setSubdivisions = (n: number) => setOptions(o => ({ ...o, subdivisions: Math.max(1, Math.min(4, Math.round(n))) }));
  const setAccentEvery = (n: number) => setOptions(o => ({ ...o, accentEvery: Math.max(1, Math.min(16, Math.round(n))) }));
  const setMute = (m: boolean) => setOptions(o => ({ ...o, mute: m }));

  const tap = () => {
    const now = performance.now();
    const history = tapHistoryRef.current;
    // keep last 6 taps
    if (history.length > 0 && now - history[history.length - 1] > 2000) {
      history.length = 0; // reset if too long between taps
    }
    history.push(now);
    if (history.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < history.length; i++) intervals.push(history[i] - history[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.max(10, Math.min(240, Math.round(60000 / avg)));
      setOptions(o => ({ ...o, bpm }));
    }
    if (history.length > 6) history.shift();
  };

  const playAccentOnce = () => {
    if (!audioRef.current) ensureAudio();
    if (!audioRef.current) return;
    const when = audioRef.current.currentTime + 0.01;
    scheduleTick(when, true);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.close();
    };
  }, []);

  return [state, { isRunning: runningRef.current, start, stop, tap, setBpm, setSubdivisions, setAccentEvery, setMute, playAccentOnce }, options];
}


