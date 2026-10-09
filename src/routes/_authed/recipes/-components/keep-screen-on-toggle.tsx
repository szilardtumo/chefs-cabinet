import { Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { toastError } from '@/lib/toast';

/** Stops the screen from turning off while cooking. */
export function KeepScreenOnToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;

    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) sentinel.release();
          else lock = sentinel;
        })
        .catch((error) => {
          setOn(false);
          toastError(error);
        });

    // The browser releases the lock whenever the page is hidden, so it's taken again on return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lock?.release();
    };
  }, [on]);

  return (
    <Toggle
      variant="outline"
      pressed={on}
      onPressedChange={setOn}
      aria-label="Keep screen on"
      title="Keep screen on"
      className="data-[state=on]:text-brand-strong"
    >
      <Lightbulb />
    </Toggle>
  );
}
