import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFocusTimerController } from '@/hooks/useFocusTimerController';

interface Props {
  taskId?: string | null;
  taskTitle?: string;
  className?: string;
}

export const FocusTimer: React.FC<Props> = ({ taskId = null, taskTitle, className }) => {
  const { timer, setTaskId } = useFocusTimerController();
  const { settings, state, timeString, controls, metro } = timer;
  React.useEffect(() => { setTaskId(taskId ?? null); }, [taskId, setTaskId]);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const progress = React.useMemo(() => {
    const total = settings.focusMinutes * 60 * 1000;
    const elapsed = Math.min(total, state.elapsedMs);
    return total > 0 ? elapsed / total : 0;
  }, [settings.focusMinutes, state.elapsedMs]);

  const ringStyle = React.useMemo(() => {
    const angle = Math.round(progress * 360);
    return {
      background: `conic-gradient(var(--ring-accent) ${angle}deg, var(--ring-base) ${angle}deg)`
    } as React.CSSProperties;
  }, [progress]);

  const handlePrimary = () => {
    if (state.status === 'running') controls.pause();
    else if (state.status === 'paused') controls.resume();
    else controls.start();
  };

  return (
    <div className={cn('relative flex flex-col items-center justify-center', className)}>
      <div className="relative w-64 h-64 select-none" aria-label="Focus timer">
        <div
          className="absolute inset-0 rounded-full blur-sm opacity-70"
          style={ringStyle}
        />
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background: 'radial-gradient(100% 100% at 50% 0%, rgba(255,255,255,0.05), rgba(0,0,0,0) 50%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08))',
            backdropFilter: 'blur(6px)'
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-5xl font-mono tracking-wider text-foreground/90">
            {timeString}
          </div>
        </div>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            reducedMotion ? '' : metro.state.isAccent ? 'animate-pulse-slow' : 'animate-pulse-tiny'
          )}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] opacity-70" />
        </div>
      </div>

      {taskTitle && (
        <div className="mt-3 text-xs text-muted-foreground">{taskTitle}</div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button variant="default" onClick={handlePrimary}>
          {state.status === 'running' ? 'Pause' : 'Start'}
        </Button>
        <Button variant="ghost" onClick={() => controls.stop()}>Stop</Button>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <div>
          BPM
          <input
            className="ml-2 w-28 align-middle"
            type="range"
            min={10}
            max={240}
            value={settings.bpm}
            onChange={(e) => controls.setBpm(parseInt(e.target.value))}
          />
          <span className="ml-1 tabular-nums">{settings.bpm}</span>
        </div>
        <button className="underline" onClick={() => timer.metro.controls.tap()}>Tap</button>
        <button className="underline" onClick={() => timer.metro.controls.playAccentOnce()}>Accent</button>
        <button className="underline" onClick={() => controls.reset()}>Reset</button>
        <button className="underline" onClick={() => controls.setMute(!settings.mute)}>
          {settings.mute ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </div>
  );
};

export default FocusTimer;


