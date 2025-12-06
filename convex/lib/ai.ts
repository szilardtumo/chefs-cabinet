import { AIError } from './errors';

/**
 * Creates a Google Generative AI instance using the GEMINI_API_KEY environment variable.
 * @returns The Google Generative AI instance
 * @throws Error if the API key is not configured
 */
export async function createGoogleAI() {
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
