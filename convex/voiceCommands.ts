import { DAY, MINUTE } from '@convex-dev/rate-limiter';
import { generateText, Output } from 'ai';
import { ConvexError, type Infer, v } from 'convex/values';
import { literals } from 'convex-helpers/validators';
import { z } from 'zod';
import { internal } from './_generated/api';
import { internalQuery } from './_generated/server';
import { createGoogleAI, GEMINI_MODELS } from './lib/ai';
import { ValidationError } from './lib/errors';
import { authenticatedAction } from './lib/helpers';
import { enforceRateLimit } from './lib/rateLimiter';
import { readingUndo } from './voiceActions/books';
import { libraryPrompt, loadLibrary } from './voiceActions/library';
import { voiceActions } from './voiceActions/registry';
import { shoppingItemsUndo } from './voiceActions/shoppingList';
import type { VoiceActionEnv, VoiceLine } from './voiceActions/types';

const undoValidator = v.union(shoppingItemsUndo.validator, readingUndo.validator);

/** What a result line hands back to `undo`; each action that can be undone adds its kind. */
export type VoiceUndo = Infer<typeof undoValidator>;

export type VoiceCommandResult = {
  transcript: string;
  /** What was done or said, one line each; replies to unsupported commands are lines without `undo` */
  outcomes: VoiceLine[];
  question?: { text: string; options: string[] };
  /** A path for the client to open, e.g. a recipe */
  navigateTo?: string;
};

const actionEntries = Object.entries(voiceActions);

/** The lists of the user's data the actions need, for the model to pick ids from. */
export const library = internalQuery({
  args: { userId: v.string() },
  handler: (ctx, { userId }) =>
    loadLibrary(
      ctx,
      userId,
      actionEntries.flatMap(([, action]) => action.needs),
    ),
});

/**
 * Understands a spoken or typed command against the user's library and carries it out with the actions in
 * `voiceActions/registry.ts`. Returns what was done, with what the client needs to undo it.
 */
export const run = authenticatedAction({
  args: {
    audio: v.optional(v.bytes()),
    mimeType: v.optional(v.string()),
    text: v.optional(v.string()),
    // Earlier turns of the conversation, so answers like "the second one" have a meaning
    history: v.array(v.object({ role: literals('user', 'assistant'), text: v.string() })),
    // The page the user is on, e.g. a recipe for "add these ingredients"
    path: v.string(),
    // `Date.getTimezoneOffset()` of the device, to place reading logged for "yesterday" on the right day
    timezoneOffset: v.number(),
  },
  handler: async (ctx, args): Promise<VoiceCommandResult> => {
    const text = args.text?.trim();
    if (!args.audio && !text) throw new ValidationError('Say or type a command');
    if (args.audio && args.audio.byteLength > 2_000_000) throw new ValidationError('Keep the command under a minute');
    await enforceRateLimit(ctx, 'voiceCommand');

    const google = await createGoogleAI(await ctx.auth.getUserIdentity());
    const userLibrary = await ctx.runQuery(internal.voiceCommands.library, { userId: ctx.userId });

    const offset = args.timezoneOffset * MINUTE;
    const localNow = new Date(Date.now() - offset);

    const schema = z.object({
      transcript: z.string().describe("The user's command as they said it, in their language"),
      ...Object.fromEntries(actionEntries.map(([name, action]) => [name, action.schema(userLibrary)])),
      question: z
        .object({ text: z.string(), options: z.array(z.string()) })
        .nullable()
        .describe('Only when the command is ambiguous: a short question with the likely answers as options'),
      reply: z
        .string()
        .optional()
        .describe('A short message when the command asks for something unsupported, or there is nothing to do'),
    });

    const { output } = await generateText({
      model: google(GEMINI_MODELS.flash),
      output: Output.object({ schema }),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
      system: `You turn the user's commands into actions in their kitchen and reading app. The user may speak any language.
Supported actions:
${actionEntries.map(([, action]) => `- ${action.instructions}`).join('\n')}
Match names loosely: across languages, singular and plural, nicknames and mishearings.
Ask a question only when the command could mean different things; otherwise act.
For anything unsupported, set reply to a one-sentence explanation of what you can do. Write the question and reply in the user's language.
Name new ingredients in the language of the existing ingredient names.

Today is ${localNow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}.
The user is on the page ${args.path}.

${libraryPrompt(userLibrary)}`,
      messages: [
        ...args.history.map(({ role, text }) => ({ role, content: text })),
        {
          role: 'user',
          content: args.audio
            ? [{ type: 'file', data: new Uint8Array(args.audio), mediaType: args.mimeType ?? 'audio/webm' }]
            : [{ type: 'text', text: text ?? '' }],
        },
      ],
    });

    const result: VoiceCommandResult = {
      transcript: output.transcript,
      outcomes: output.reply ? [{ message: output.reply }] : [],
      question: output.question ?? undefined,
    };
    const report = (line: VoiceLine) => result.outcomes.push(line);
    const env: VoiceActionEnv = {
      ctx,
      library: userLibrary,
      localMidnight: Math.floor(localNow.getTime() / DAY) * DAY + offset,
      report,
      attempt: async (failure, work) => {
        try {
          report(await work());
        } catch (error) {
          const message = error instanceof ConvexError && typeof error.data === 'string' ? error.data : failure;
          report({ message, error: true });
        }
      },
      navigate: (path) => {
        result.navigateTo = path;
      },
    };
    // The actions' fields, by name; the schema above is built from the same list
    const outputs: Record<string, unknown> = output;
    for (const [name, action] of actionEntries) {
      if (outputs[name] != null) await action.run(outputs[name], env);
    }

    return result;
  },
});

/** Undoes a change a command made, from the `undo` of its result line. */
export const undo = authenticatedAction({
  args: { change: undoValidator },
  handler: async (ctx, { change }) => {
    if (change.type === 'shoppingItems') await shoppingItemsUndo.run(ctx, change);
    else await readingUndo.run(ctx, change);
  },
});
