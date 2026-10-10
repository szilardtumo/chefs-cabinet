import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Command } from '@/components/voice-command/voice-command-provider';
import { toastWithUndo } from '@/lib/toast';

/**
 * Shows a command's result as toasts; what was heard goes under the first one.
 * A question gets its answers as buttons, which call `onAnswer`.
 */
export function toastCommand({ text, lines, question }: Command, onAnswer: (answer: string) => void) {
  lines.forEach(({ message, error, undo }, index) => {
    const description = index === 0 ? text : undefined;
    if (error) toast.error(message, { description });
    else if (undo) toastWithUndo(message, undo, description);
    else toast(message, { description });
  });

  if (question) {
    toast.custom(
      (toastId) => (
        <div className="flex w-(--width) flex-col gap-3 rounded-md border bg-popover p-4 text-sm text-popover-foreground shadow-lg">
          <p className="font-medium">{question.text}</p>
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => (
              <Button
                key={option}
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.dismiss(toastId);
                  onAnswer(option);
                }}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      ),
      // Long enough to read the question and pick an answer
      { duration: 15_000 },
    );
  }
}

export function toastNothingHeard() {
  toast.error("Didn't catch that", { description: 'Try again, a bit closer to the phone.' });
}

export function toastMicrophoneBlocked() {
  toast.error('Microphone blocked', {
    description: 'Allow the microphone for this site, or type the command in the history.',
  });
}
