import { Check, Mic, Square, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useVoiceCommand } from '@/components/voice-command/voice-command-provider';
import { cn } from '@/lib/utils';

// How tall each bar gets relative to the others, so they look balanced while following one loudness
const SHAPE = [0.6, 1, 0.8, 0.5];

/** Bars that follow the voice, updated outside React on every frame so they move smoothly. */
function LevelBars({ analyser }: { analyser: AnalyserNode }) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const samples = new Float32Array(analyser.fftSize);
    let level = 0;
    let frame = 0;
    const draw = (time: number) => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      // A quiet room stays around 0.01; the square root lifts quiet speech, and 0.06 already fills the bars.
      // Eases toward the new level, so the bars don't jitter
      level += (Math.min(1, Math.sqrt(Math.max(0, rms - 0.01) / 0.05)) - level) * 0.4;
      SHAPE.forEach((shape, index) => {
        // Each bar wobbles a little on its own, so they don't move in lockstep
        const voice = level * shape * (0.8 + 0.2 * Math.sin(time / 90 + index * 2));
        // A slow wave across the bars while it's quiet, so the pill still shows it's listening; speech takes over
        const idle = 0.15 + 0.15 * Math.sin(time / 250 - index * 0.9);
        barsRef.current[index]?.style.setProperty('transform', `scaleY(${0.25 + Math.max(voice, idle) * 0.75})`);
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <span className="flex h-3.5 items-center gap-0.5">
      {SHAPE.map((shape, index) => (
        <span
          key={shape}
          ref={(element) => {
            barsRef.current[index] = element;
          }}
          className="h-full w-0.5 rounded-full bg-current"
          // The same property the animation sets; Tailwind's scale-y-* uses `scale`, which would multiply with it
          style={{ transform: 'scaleY(0.25)' }}
        />
      ))}
    </span>
  );
}

/**
 * The mic button: idle, a red pill with a stop square and level bars while listening, a spinner while working,
 * then a check or cross. One button that changes width and color, so the switch animates.
 */
export function VoiceButton() {
  const { status, toggleListening } = useVoiceCommand();
  const listening = status.type === 'listening';

  return (
    <Button
      size="icon"
      className={cn(
        // Stays solid while disabled, so the spinner keeps its contrast
        'h-7 w-7 rounded-md transition-[width,border-radius,background-color,color] duration-300 disabled:opacity-100',
        // Half the height instead of rounded-full, which can't be animated to
        listening && 'w-13 rounded-[0.875rem]',
        (listening || status.type === 'failed') && 'bg-red-700 text-white hover:bg-red-700/90',
      )}
      aria-label={listening ? 'Stop listening' : 'Voice command'}
      disabled={status.type === 'working'}
      onClick={toggleListening}
    >
      {/* The key replays the entrance animation each time the content changes */}
      <span key={status.type} className="flex items-center gap-1.5 animate-in fade-in zoom-in-50 duration-300">
        {status.type === 'listening' ? (
          <>
            <Square className="size-2.5 fill-current" />
            <LevelBars analyser={status.analyser} />
          </>
        ) : status.type === 'working' ? (
          <Spinner />
        ) : status.type === 'done' ? (
          <Check />
        ) : status.type === 'failed' ? (
          <X />
        ) : (
          <Mic />
        )}
      </span>
    </Button>
  );
}
