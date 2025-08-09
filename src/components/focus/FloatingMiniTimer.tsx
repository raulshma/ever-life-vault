import React from 'react';
import { useFocusTimerController } from '@/hooks/useFocusTimerController';
import { cn } from '@/lib/utils';

export const FloatingMiniTimer: React.FC = () => {
  const { timer } = useFocusTimerController();
  const { timeString, state, controls } = timer;
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-40 rounded-full backdrop-blur-md bg-background/70 shadow-lg transition-all',
        expanded ? 'px-3 py-2' : 'px-2 py-1'
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            state.status === 'running' ? 'bg-[hsl(var(--primary))] animate-pulse' : 'bg-muted-foreground'
          )}
        />
        <div className="font-mono text-xs tabular-nums">{timeString}</div>
        {expanded && (
          <div className="flex items-center gap-2 ml-2">
            <button className="text-xs underline" onClick={() => (state.status === 'running' ? controls.pause() : controls.start())}>
              {state.status === 'running' ? 'Pause' : 'Start'}
            </button>
            <button className="text-xs underline" onClick={() => controls.stop()}>Stop</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingMiniTimer;


