# Contributing to noupload

Thanks for your interest in contributing!

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev`
4. Make your changes
5. Run build to check for errors: `pnpm build`

## Project Structure

```
src/
├── routes/              # TanStack Router pages (flat file routing)
│   ├── __root.tsx       # Root layout (header, footer, 404, error)
│   ├── index.tsx        # Home page
│   ├── compress.tsx     # /compress
│   ├── image.crop.tsx   # /image/crop
│   ├── audio.trim.tsx   # /audio/trim
│   └── ...
├── app/                 # Shared app-level modules
│   ├── globals.css      # Global styles
│   ├── tools-hub.tsx    # Homepage tool grid
│   ├── *-tools-grid.tsx # Tool definitions per category
│   ├── edit/            # PDF editor components/hooks/lib
│   └── image/edit/      # Image editor components/hooks/lib
├── components/
│   ├── icons/           # Custom SVG icons
│   ├── pdf/             # PDF-related components
│   ├── image/           # Image-related components
│   ├── audio/           # Audio-related components
│   ├── shared/          # Shared UI components
│   └── ui/              # Base UI components (shadcn)
├── hooks/               # Shared React hooks
└── lib/                 # Core utilities and processing logic
```

## Adding a New Tool

1. Create a route file in `src/routes/` (e.g. `src/routes/image.new-tool.tsx`)
2. Add `createFileRoute` with `head()` metadata and your component
3. Add the processing logic in `src/lib/`
4. Add the tool to the relevant `*-tools-grid.tsx` file
5. Add the tool color class in `src/app/globals.css`
6. Add the route to `public/sitemap.xml`

## Design Guidelines

Follow the Neo-Brutalist design system:
- Thick 2px black borders
- Bold typography
- Warm cream background (#FAF8F5)
- Tool-specific accent colors
- No rounded corners (or minimal)

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Keep components focused and small
- Client-side only — no server logic
- Use `pnpm` (not npm/yarn/bun)

## Pull Request Process

1. Update README if adding features
2. Make sure `pnpm build` passes with no errors
3. Keep PRs focused on a single change
4. Write clear commit messages

## Questions?

Open an issue if you're unsure about anything.
