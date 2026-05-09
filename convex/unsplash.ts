import { v } from 'convex/values';
import { authenticatedAction } from './lib/helpers';

type UnsplashSearchResponse = {
  results: {
    id: string;
    urls: { small: string; regular: string };
    links: { download_location: string };
    alt_description?: string;
    description?: string;
    user: { name: string; username: string };
  }[];
  total: number;
};

/**
 * Search Unsplash for stock photos (cover images). The access key stays on the server.
 */
export const searchPhotos = authenticatedAction({
  args: {
    query: v.string(),
    page: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      throw new Error('Unsplash search is not configured. Set UNSPLASH_ACCESS_KEY in your Convex environment.');
    }

    const trimmed = args.query.trim();
    if (trimmed.length < 2) {
      return { results: [], total: 0 };
    }

    const page = Math.max(1, args.page ?? 1);
    const params = new URLSearchParams({
      query: trimmed,
      page: String(page),
      per_page: '18',
      orientation: 'landscape',
    });

    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Unsplash search failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as UnsplashSearchResponse;

    return {
      results: data.results.map((p) => ({
        id: p.id,
        thumbUrl: p.urls.small,
        imageUrl: p.urls.regular,
        alt: p.alt_description || p.description || 'Unsplash photo',
        photographer: p.user.name,
      })),
      total: data.total,
    };
  },
});
