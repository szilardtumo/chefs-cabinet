# Chef's Cabinet 🍳

A modern kitchen management application with AI-powered recipe enhancement. Organize your recipes, manage ingredients, and create smart shopping lists.

## Features

### 📖 Recipe Management
- Create and organize your recipes
- Upload recipe images
- Add ingredients with quantities and units
- Step-by-step instructions with drag-and-drop reordering
- Tag recipes for easy categorization
- Track recipe history and modifications

### 🤖 AI-Powered Enhancement
- Generate recipe descriptions with AI
- Enhance existing descriptions
- Customize descriptions with custom prompts
- Full history tracking of AI modifications

### 🥕 Ingredient Organization
- Comprehensive ingredient library
- Categorize ingredients with emojis and colors
- Add custom emojis to ingredients
- Default units for quick recipe creation
- Search and filter capabilities

### 📂 Category Management
- Create custom categories
- Drag-and-drop reordering
- Color coding and emoji icons
- Pre-populated with common categories

### 🛒 Smart Shopping Lists
- Create multiple shopping lists
- Add ingredients manually or from recipes
- Auto-grouped by category
- "Store Mode" for easy in-store use
- Check off items with large touch targets
- Track progress with visual indicators
- Mark lists as completed

## Tech Stack

- **Frontend**: React 19, TanStack Start, TanStack Router
- **Backend**: Convex (realtime database and backend)
- **Authentication**: Clerk
- **UI Components**: ShadCN UI (New York style)
- **Forms**: TanStack Forms with Zod validation
- **Drag & Drop**: @dnd-kit
- **Tables**: TanStack Table
- **AI**: Vercel AI SDK with OpenAI
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Convex account ([convex.dev](https://convex.dev))
- Clerk account ([clerk.com](https://clerk.com))
- OpenAI API key (optional, for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd chefs-cabinet
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up Convex:
```bash
npx convex dev
```

4. Configure Clerk:
   - Create a new application in Clerk
   - Add your Clerk publishable key to your environment
   - Configure the Convex integration in Clerk

5. (Optional) Add OpenAI API key:
```bash
# In your Convex dashboard, add environment variable:
OPENAI_API_KEY=your_key_here
```

6. Start the development server:
```bash
pnpm dev
```

The app will open at `http://localhost:3000`

## Project Structure

```
chefs-cabinet/
├── convex/                      # Convex backend
│   ├── schema.ts               # Database schema
│   ├── categories.ts           # Category operations
│   ├── ingredients.ts          # Ingredient operations
│   ├── recipes.ts              # Recipe operations
│   ├── recipeIngredients.ts    # Recipe-ingredient relations
│   ├── shoppingLists.ts        # Shopping list operations
│   ├── shoppingListItems.ts    # Shopping list item operations
│   ├── ai.ts                   # AI integration
│   └── seed.ts                 # Default data seeding
├── src/
│   ├── components/
│   │   ├── AppLayout.tsx       # Main layout with sidebar
│   │   └── ui/                 # ShadCN components
│   ├── routes/
│   │   ├── _authed/            # Protected routes
│   │   │   ├── dashboard.tsx
│   │   │   ├── ingredients.*.tsx
│   │   │   ├── recipes.*.tsx
│   │   │   └── shopping.*.tsx
│   │   └── index.tsx
│   └── hooks/
│       └── use-toast.ts        # Toast notifications
└── package.json
```

## Database Schema

### Categories
- Organize ingredients with custom emojis and colors
- Drag-and-drop ordering

### Ingredients
- Linked to categories
- Optional emoji and default unit
- Used in recipes and shopping lists

### Recipes
- Complete recipe information
- Linked to ingredients via join table
- Image storage via Convex
- History tracking for all changes

### Shopping Lists
- Multiple lists with status (active/completed/archived)
- Items linked to ingredients
- Notes field for quantities (MVP)

## Key Features Explained

### AI Integration

The AI features work with OpenAI's GPT-4 but gracefully degrade if no API key is configured:

- **Generate**: Creates a description from title, ingredients, and cooking time
- **Enhance**: Improves existing descriptions
- **Customize**: Modifies based on custom user prompts

All AI interactions are tracked in recipe history.

### Store Mode

Optimized view for shopping in physical stores:
- Large, touch-friendly interface
- Only shows unchecked items
- Grouped by category/aisle
- Quick check-off with tap

### Data Seeding

On first login, users automatically get:
- 10 default categories (Vegetables, Fruits, Meat, etc.)
- 30+ common ingredients
- All customizable and deletable

## Environment Variables

### Convex (.env.local in convex/)
```bash
OPENAI_API_KEY=sk-...          # Optional: For AI features
```

### Clerk
Configure through Clerk dashboard and Convex integration

## Development

### Generate Route Tree
```bash
npx tsr generate
```

### Type Generation
Convex automatically generates types on file changes

### Build for Production
```bash
pnpm build
```

## Features Not Included (Future Enhancements)

- Nutrition tracking
- Recipe sharing between users
- Unit conversions (currently metric only)
- Meal planning calendar
- Recipe import from URLs
- Print functionality
- Cost tracking
- Multiple images per recipe

## Contributing

This is a personal project but feel free to fork and customize for your needs!

## License

MIT

## Acknowledgments

- Built with [Convex](https://convex.dev)
- UI components from [ShadCN](https://ui.shadcn.com)
- Authentication by [Clerk](https://clerk.com)
- AI powered by [OpenAI](https://openai.com)
