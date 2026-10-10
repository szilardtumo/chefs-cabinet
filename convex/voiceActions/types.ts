import type { z } from 'zod';
import type { ActionCtx } from '../_generated/server';
import type { VoiceUndo } from '../voiceCommands';
import type { Library, LibraryPart } from './library';

/** One line of a command's result: what was done or said, and how to undo it. */
export type VoiceLine = { message: string; error?: boolean; undo?: VoiceUndo };

/** What an action gets to carry out its part of a command. */
export type VoiceActionEnv = {
  ctx: ActionCtx & { userId: string };
  library: Library;
  /** Midnight of today on the user's device, as a timestamp */
  localMidnight: number;
  /** Adds a line to the result */
  report: (line: VoiceLine) => void;
  /** Runs `work` and adds its line, or an error line with `failure` (or the validation message) when it throws */
  attempt: (failure: string, work: () => Promise<VoiceLine>) => Promise<void>;
  /** Asks the client to open this path */
  navigate: (path: string) => void;
};

/**
 * Something a command can do. The model fills the action's field in its output (`schema`), described by
 * `instructions`, and `run` carries it out. `needs` names the library lists the model must see for it.
 */
export type VoiceAction<Output> = {
  needs: LibraryPart[];
  instructions: string;
  schema: z.ZodType<Output>;
  run: (output: Output, env: VoiceActionEnv) => Promise<void>;
};

/** Keeps the output type of an action tied to its `run`, then erases it, so actions of any output fit one list. */
export function defineVoiceAction<Output>(action: VoiceAction<Output>) {
  return action as unknown as VoiceAction<unknown>;
}
