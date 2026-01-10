import type { UserIdentity } from 'convex/server';
import { AIError } from './errors';

/**
 * Checks if AI features are enabled for the given user identity.
 * Requires the `aiEnabled` custom claim to be configured in the Clerk JWT template:
 * { "aiEnabled": "{{user.public_metadata.aiEnabled}}" }
 */
function isAiEnabled(identity: UserIdentity | null): boolean {
  if (!identity) {
    return false;
  }

  // Access the custom `aiEnabled` claim from Clerk JWT template
  const aiEnabled = (identity as unknown as { aiEnabled?: boolean }).aiEnabled;
  return aiEnabled === true;
}

/**
 * Creates a Google Generative AI instance using the GEMINI_API_KEY environment variable.
 * Requires the user to have AI features enabled.
 *
 * @param identity - The authenticated user's identity from Clerk
 * @returns The Google Generative AI instance
 * @throws AIError if AI is not enabled for the user or API key is not configured
 */
export async function createGoogleAI(identity: UserIdentity | null) {
  if (!isAiEnabled(identity)) {
    throw new AIError('AI features are not enabled for your account.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.');
    throw new AIError('AI features are not available.');
  }

  const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
  return createGoogleGenerativeAI({
    apiKey: apiKey,
  });
}
