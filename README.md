# Chef's Cabinet

<img src="public/android-chrome-192x192.png" alt="" width="96" align="right">

A kitchen app for your recipes, ingredients, cookbooks and shopping lists. It installs on your phone as a web app.

## Features

- Recipes with ingredients, steps, images, tags and a change history
- Recipe import from a URL or pasted text, and edits by prompt, using Gemini
- An ingredient library grouped into categories with emojis and colors
- Shopping lists grouped by category, filled by hand or from a recipe
- A cookbook library: add books from Hardcover or Open Library by search, ISBN or barcode, and track reading progress

## Install on your phone

Open the deployed app in your phone's browser, then:

- Android (Chrome): menu, then "Install app" or "Add to Home screen".
- iPhone (Safari): Share, then "Add to Home Screen".

## Tech stack

React 19, TanStack Start and Router, Convex, Clerk, shadcn/ui, Tailwind CSS, Vercel AI SDK with Google Gemini.

## Getting started

You need Node.js 20.19+, pnpm, a [Convex](https://convex.dev) project and a [Clerk](https://clerk.com) application.

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the Clerk keys and `VITE_CONVEX_URL`.
3. In Clerk, create a JWT template named `convex`. To allow a user to use the AI features, add the claim `{ "aiEnabled": "{{user.public_metadata.aiEnabled}}" }` and set `aiEnabled: true` in that user's public metadata.
4. Set these environment variables on your Convex deployment (`npx convex env set NAME value`):

   | Variable | Used for |
   |---|---|
   | `CLERK_FRONTEND_API_URL` | Verifying Clerk tokens |
   | `GEMINI_API_KEY` | Recipe import and AI edits |
   | `UNSPLASH_ACCESS_KEY` | Cover photo search |
   | `HARDCOVER_API_KEY` | Book search and ISBN lookup |

5. Start Convex and the dev server:
   ```bash
   pnpm dev
   ```

The app runs at `http://localhost:3000`.

## Scripts

- `pnpm dev` starts Vite and Convex in watch mode.
- `pnpm build` builds the app and type-checks it.
- `pnpm start` serves the production build.

## License

[MIT](LICENSE)
