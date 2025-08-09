import React from 'react';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { useFocusTimerController } from '@/hooks/useFocusTimerController';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const presets = [
  { label: 'Pomodoro 25/5', mode: 'pomodoro_25_5' as const, focus: 25, brk: 5 },
  { label: 'Pomodoro 30/5', mode: 'pomodoro_30_5' as const, focus: 30, brk: 5 },
  { label: 'Pomodoro 45/15', mode: 'pomodoro_45_15' as const, focus: 45, brk: 15 },
  { label: 'Pomodoro 50/10', mode: 'pomodoro_50_10' as const, focus: 50, brk: 10 },
  { label: 'Pomodoro 60/15', mode: 'pomodoro_60_15' as const, focus: 60, brk: 15 },
  { label: '52/17', mode: 'fiftytwo_17' as const, focus: 52, brk: 17 },
  { label: 'Flow 90', mode: 'flow_90' as const, focus: 90, brk: 10 },
  { label: 'Flow 120/15', mode: 'flow_120_15' as const, focus: 120, brk: 15 },
  { label: 'Ultradian 90/20', mode: 'ultradian_90_20' as const, focus: 90, brk: 20 },
];

const profiles = [
  { label: 'Deep Work', bpm: 20, accentEvery: 4, subdivisions: 1 },
  { label: 'Review', bpm: 30, accentEvery: 10, subdivisions: 1 },
  { label: 'Breath', bpm: 6, accentEvery: 3, subdivisions: 1 },
  { label: 'Light Flow', bpm: 16, accentEvery: 4, subdivisions: 1 },
  { label: 'Focus Sprint', bpm: 24, accentEvery: 6, subdivisions: 1 },
  { label: 'Code Rhythm 2', bpm: 22, accentEvery: 4, subdivisions: 2 },
  { label: 'Code Rhythm 4', bpm: 22, accentEvery: 4, subdivisions: 4 },
  { label: 'PR Review Bell', bpm: 30, accentEvery: 10, subdivisions: 1 },
  { label: 'Zen Glass', bpm: 18, accentEvery: 6, subdivisions: 1 },
];

export default function Focus() {
  const { timer } = useFocusTimerController();
  const { settings, controls } = timer;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Aurora Field background */}
      <div className="absolute inset-0 -z-10 aurora">
        <div className="aurora-blob aurora-blob--primary w-[50vw] h-[50vw] top-[-10%] left-[-10%] float-slow" />
        <div className="aurora-blob aurora-blob--accent w-[55vw] h-[55vw] bottom-[-15%] right-[-5%] float-med" />
        <div className="aurora-blob aurora-blob--violet w-[45vw] h-[45vw] top-[20%] right-[10%] float-fast" />
      </div>

      <div className="container py-10">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <Card className="glass shadow-card border-0">
            <CardContent className="py-10 grid place-items-center">
              <FocusTimer />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="glass shadow-card border-0">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-3">Presets</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => (
                    <Button
                      key={p.label}
                      variant="secondary"
                      size="sm"
                      onClick={() => controls.setModeAndDurations(p.mode, p.focus, p.brk)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass shadow-card border-0">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-3">Profiles</div>
                <div className="flex flex-wrap gap-2">
                  {profiles.map(pr => (
                    <Button
                      key={pr.label}
                      variant="outline"
                      size="sm"
                      onClick={() => controls.setProfile(pr.label, pr.bpm, pr.accentEvery, pr.subdivisions)}
                    >
                      {pr.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass shadow-card border-0">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-3">Metronome</div>
                <div className="text-xs text-muted-foreground">BPM: {settings.bpm}</div>
                <div className="mt-2 flex items-center gap-3">
                  <Button size="sm" onClick={() => controls.setBpm(Math.max(10, settings.bpm - 1))}>-</Button>
                  <input
                    className="w-full"
                    type="range"
                    min={10}
                    max={240}
                    value={settings.bpm}
                    onChange={(e) => controls.setBpm(parseInt(e.target.value))}
                  />
                  <Button size="sm" onClick={() => controls.setBpm(Math.min(240, settings.bpm + 1))}>+</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


