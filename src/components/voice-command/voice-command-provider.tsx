import { api } from '@convex/_generated/api';
import { useConvexAction } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { toastCommand, toastMicrophoneBlocked, toastNothingHeard } from '@/components/voice-command/voice-toasts';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useCallbackRef } from '@/hooks/use-callback-ref';
import { errorMessage, toastError } from '@/lib/toast';

/** One line of a command's result: what was done or said, and how to undo it. */
export type CommandLine = { message: string; error?: boolean; undone?: boolean; undo?: () => Promise<void> };

/** One command: what was typed, or for a spoken one what was heard once it's understood, then its result. */
export type Command = {
  id: string;
  text?: string;
  lines: CommandLine[];
  question?: { text: string; options: string[] };
};

type VoiceCommandState = {
  status: { type: 'idle' | 'working' | 'done' | 'failed' } | { type: 'listening'; analyser: AnalyserNode };
  toggleListening: () => void;
  commands: Command[];
  send: (text: string) => void;
};

const VoiceCommandContext = createContext<VoiceCommandState | null>(null);

/**
 * Spoken and typed commands: add to the shopping list, open a recipe or log reading.
 * Results come as toasts with Undo, and stay in the history. `VoiceButton` and `VoiceHistory` read it.
 */
export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [outcome, setOutcome] = useState<'done' | 'failed'>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { listen } = useSearch({ strict: false });

  const runAction = useConvexAction(api.voiceCommands.run);
  const { mutateAsync: runCommand, isPending } = useMutation({
    // Reads the clip inside the mutation, so it counts as pending (and shows the spinner) from the moment it's sent
    mutationFn: async ({ audio, text }: { audio?: Blob; text?: string }) =>
      runAction({
        audio: await audio?.arrayBuffer(),
        mimeType: audio?.type.split(';')[0],
        text,
        history: commands.flatMap(({ text, lines, question }) =>
          text
            ? [
                { role: 'user' as const, text },
                { role: 'assistant' as const, text: [...lines.map((line) => line.message), question?.text].join('\n') },
              ]
            : [],
        ),
        path: pathname,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
  });
  const undoChange = useConvexAction(api.voiceCommands.undo);

  async function run(input: { audio?: Blob; text?: string }) {
    const id = crypto.randomUUID();
    const update = (change: (command: Command) => Command) =>
      setCommands((previous) => previous.map((command) => (command.id === id ? change(command) : command)));
    setCommands((previous) => [...previous, { id, text: input.text, lines: [] }]);

    try {
      const result = await runCommand(input);
      const lines = result.outcomes.map(
        ({ undo, ...line }, index): CommandLine => ({
          ...line,
          undo:
            undo &&
            (async () => {
              try {
                await undoChange({ change: undo });
                update((command) => ({
                  ...command,
                  lines: command.lines.map((other, otherIndex) =>
                    otherIndex === index ? { ...other, undone: true } : other,
                  ),
                }));
              } catch (error) {
                toastError(error);
              }
            }),
        }),
      );
      // Falls back to the typed text, and keeps the bubble from being empty when nothing was transcribed
      const text = result.transcript || input.text || '(nothing heard)';
      update((command) => ({ ...command, text, lines, question: result.question }));
      const done = result.navigateTo || lines.some((line) => line.undo);
      // A clip without speech: Gemini returns no transcript, at most a generic reply, which isn't worth a toast
      if (!result.transcript.trim() && !done) {
        setOutcome('failed');
        toastNothingHeard();
        return;
      }
      toastCommand({ id, text, lines, question: result.question }, (answer) => void run({ text: answer }));
      setOutcome(lines.some((line) => line.error) ? 'failed' : done ? 'done' : undefined);
      if (result.navigateTo) await navigate({ href: result.navigateTo });
    } catch (error) {
      update((command) => ({ ...command, lines: [{ message: errorMessage(error), error: true }] }));
      setOutcome('failed');
      toastError(error);
    }
  }

  const recorder = useAudioRecorder((audio) => {
    if (audio) void run({ audio });
    else {
      setOutcome('failed');
      toastNothingHeard();
    }
  });

  function startListening() {
    setOutcome(undefined);
    recorder.start().catch((error) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') toastMicrophoneBlocked();
      else toastError(error);
    });
  }

  // The "Voice command" app shortcut opens the dashboard with `?listen=true`
  const listenFromShortcut = useCallbackRef(() => {
    void navigate({ to: '/dashboard', search: {}, replace: true });
    startListening();
  });
  useEffect(() => {
    if (listen) listenFromShortcut();
  }, [listen, listenFromShortcut]);

  // The check or cross shows briefly, then the mic is back
  useEffect(() => {
    if (!outcome) return;
    const timeout = setTimeout(() => setOutcome(undefined), 1500);
    return () => clearTimeout(timeout);
  }, [outcome]);

  return (
    <VoiceCommandContext
      value={{
        status: recorder.analyser
          ? { type: 'listening', analyser: recorder.analyser }
          : { type: isPending ? 'working' : (outcome ?? 'idle') },
        toggleListening: () => (recorder.analyser ? recorder.stop() : startListening()),
        commands,
        send: (text) => void run({ text }),
      }}
    >
      {children}
    </VoiceCommandContext>
  );
}

export function useVoiceCommand() {
  const context = useContext(VoiceCommandContext);
  if (!context) throw new Error('useVoiceCommand must be used within a VoiceCommandProvider.');
  return context;
}
