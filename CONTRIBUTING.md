# Contributing to PDF0

Thanks for your interest in contributing!

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `bun install`
3. Start dev server: `bun dev`
4. Make your changes
5. Run build to check for errors: `bun run build`

## Project Structure

```
src/
├── app/                 # Next.js pages
│   ├── merge/          # Each tool has its own folder
│   ├── split/
│   └── ...
├── components/
│   ├── icons.tsx       # Custom SVG icons
│   ├── pdf/            # PDF-related components
│   └── ui/             # Shared UI components
└── lib/
    ├── pdf-utils.ts    # Core PDF operations (pdf-lib)
    └── pdf-image-utils.ts  # Image conversion (pdfjs-dist)
```

## Adding a New Tool

1. Create a new folder in `src/app/your-tool/`
2. Add the page component in `page.tsx`
3. Add the PDF operation in `src/lib/pdf-utils.ts`
4. Add an icon in `src/components/icons.tsx`
5. Add the tool to the homepage grid in `src/app/page.tsx`
6. Add the tool color in `src/app/globals.css`

## Design Guidelines

Follow the Neo-Brutalist design system in `DESIGN.md`:
- Thick 2px black borders
- Bold typography
- Warm cream background (#FAF8F5)
- Tool-specific accent colors
- No rounded corners (or minimal)

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Keep components focused and small
- Client-side only — no server actions

## Pull Request Process

1. Update README if adding features
2. Make sure build passes
3. Keep PRs focused on a single change
4. Write clear commit messages

## Questions?

Open an issue if you're unsure about anything.
