import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMetronome } from '@/hooks/useMetronome';
import { useFocusSessions, FocusMode } from '@/hooks/useFocusSessions';

export type TimerStatus = 'idle' | 'countdown' | 'running' | 'paused' | 'break' | 'finished';

export interface TimerSettings {
  mode: FocusMode;
  focusMinutes: number;
  breakMinutes: number;
  countdownSeconds: number; // optional 3-2-1
  profileName: string | null;
  bpm: number;
  accentEvery: number;
  subdivisions: number;
  mute: boolean;
}

export interface TimerState {
  status: TimerStatus;
  remainingMs: number;
  elapsedMs: number;
  isOverrun: boolean;
  sessionId: string | null;
}

export function useFocusTimer(initialTaskId?: string | null) {
  const [settings, setSettings] = useState<TimerSettings>({
    mode: 'pomodoro_25_5',
    focusMinutes: 25,
    breakMinutes: 5,
    countdownSeconds: 0,
    profileName: 'Deep Work',
    bpm: 20,
    accentEvery: 4,
    subdivisions: 1,
    mute: false,
  });

  const [state, setState] = useState<TimerState>({
    status: 'idle',
    remainingMs: settings.focusMinutes * 60 * 1000,
    elapsedMs: 0,
    isOverrun: false,
    sessionId: null,
  });

  const [metroState, metroControls, metroOptions] = useMetronome({
    bpm: settings.bpm,
    subdivisions: settings.subdivisions,
    accentEvery: settings.accentEvery,
    mute: settings.mute,
  });

  const { startSession, endSession } = useFocusSessions();
  const timerRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      metroControls.stop();
    };
  }, []);

  const tick = useCallback(() => {
    if (startTimestampRef.current == null) return;
    const now = performance.now();
    const elapsed = now - startTimestampRef.current;
    const duration = (state.isOverrun ? 0 : settings.focusMinutes * 60 * 1000);
    const remaining = Math.max(0, duration - elapsed);
    const isOverrun = duration > 0 && elapsed > duration;
    setState(prev => ({ ...prev, remainingMs: remaining, elapsedMs: elapsed, isOverrun }));
    timerRef.current = requestAnimationFrame(tick);
  }, [settings.focusMinutes, state.isOverrun]);

  const start = useCallback(async () => {
    if (state.status === 'running') return;
    startTimestampRef.current = performance.now() + (settings.countdownSeconds > 0 ? settings.countdownSeconds * 1000 : 0);
    setState(prev => ({ ...prev, status: settings.countdownSeconds > 0 ? 'countdown' : 'running' }));
    metroControls.start();
    const session = await startSession({
      taskId: initialTaskId ?? null,
      mode: settings.mode,
      profile: settings.profileName,
      bpm: settings.bpm,
      accentEvery: settings.accentEvery,
      subdivisions: settings.subdivisions,
      isBreak: false,
    });
    setState(prev => ({ ...prev, sessionId: session?.id ?? null }));
    // Start ticking after slight delay to ease-in
    setTimeout(() => {
      startTimestampRef.current = performance.now();
      setState(prev => ({ ...prev, status: 'running' }));
      timerRef.current = requestAnimationFrame(tick);
    }, settings.countdownSeconds > 0 ? settings.countdownSeconds * 1000 : 500);
  }, [state.status, metroControls, startSession, initialTaskId, settings, tick]);

  const pause = useCallback(() => {
    if (state.status !== 'running') return;
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    metroControls.stop();
    setState(prev => ({ ...prev, status: 'paused' }));
  }, [state.status, metroControls]);

  const resume = useCallback(() => {
    if (state.status !== 'paused') return;
    metroControls.start();
    startTimestampRef.current = performance.now() - state.elapsedMs;
    setState(prev => ({ ...prev, status: 'running' }));
    timerRef.current = requestAnimationFrame(tick);
  }, [state.status, metroControls, state.elapsedMs, tick]);

  const stop = useCallback(async () => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    metroControls.stop();
    if (state.sessionId) {
      await endSession(state.sessionId);
    }
    setState(prev => ({ ...prev, status: 'finished' }));
  }, [metroControls, endSession, state.sessionId]);

  const reset = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    metroControls.stop();
    startTimestampRef.current = null;
    setState({
      status: 'idle',
      remainingMs: settings.focusMinutes * 60 * 1000,
      elapsedMs: 0,
      isOverrun: false,
      sessionId: null,
    });
  }, [metroControls, settings.focusMinutes]);

  const setBpm = (bpm: number) => { setSettings(s => ({ ...s, bpm })); metroControls.setBpm(bpm); };
  const setAccentEvery = (n: number) => { setSettings(s => ({ ...s, accentEvery: n })); metroControls.setAccentEvery(n); };
  const setSubdivisions = (n: number) => { setSettings(s => ({ ...s, subdivisions: n })); metroControls.setSubdivisions(n); };
  const setMute = (m: boolean) => { setSettings(s => ({ ...s, mute: m })); metroControls.setMute(m); };

  const setModeAndDurations = (mode: FocusMode, focusMinutes: number, breakMinutes: number, profileName?: string | null) => {
    setSettings(s => ({ ...s, mode, focusMinutes, breakMinutes, profileName: profileName ?? s.profileName }));
    setState(prev => ({ ...prev, remainingMs: focusMinutes * 60 * 1000, elapsedMs: 0, isOverrun: false }));
  };

  const setProfile = (name: string, bpm: number, accentEvery: number, subdivisions: number) => {
    setSettings(s => ({ ...s, profileName: name, bpm, accentEvery, subdivisions }));
    metroControls.setBpm(bpm);
    metroControls.setAccentEvery(accentEvery);
    metroControls.setSubdivisions(subdivisions);
  };

  const minutes = Math.floor(state.remainingMs / 1000 / 60);
  const seconds = Math.floor((state.remainingMs / 1000) % 60);
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    settings,
    state,
    timeString,
    controls: { start, pause, resume, stop, reset, setBpm, setAccentEvery, setSubdivisions, setMute, setModeAndDurations, setProfile },
    metro: { state: metroState, options: metroOptions, controls: metroControls },
  };
}


