# Frontend Deep Dive (`frontend/`)

## 1) Stack and Build

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript + React 19
- **Styling**: Tailwind CSS v4 + custom CSS variables
- **Animation/UI**: Framer Motion + Lucide icons
- **Theme**: `next-themes` with dark mode default

Scripts (`package.json`):

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## 2) Routing and Pages

### `/` — Landing page (`app/page.tsx`)

- Marketing-oriented hero and feature sections.
- Animated background, floating nodes, and workflow explanation.
- CTA routes to `/dashboard`.

### `/dashboard` — Execution UI (`app/dashboard/page.tsx`)

- Accepts natural-language intent input.
- Sends `POST /api/execute` request.
- Simulates streaming trace output at fixed interval (800ms per item).
- Renders summary card after trace playback completes.
- Shows agent “active” state in sidebar during streaming.

### Shared layout (`app/layout.tsx`)

- Loads Geist fonts.
- Configures app metadata.
- Wraps application with theme provider.

## 3) API Connectivity

File: `next.config.ts`

Frontend rewrites `/api/:path*` to `http://localhost:3001/:path*`.  
This allows dashboard code to call `fetch("/api/execute")` without hardcoding backend host in component logic.

## 4) Component Layer

- `components/navbar.tsx`: top navigation shell + theme toggle.
- `components/theme-toggle.tsx`: dark/light mode switch.
- `components/theme-provider.tsx`: wrapper over `NextThemesProvider`.
- `lib/utils.ts`: `cn()` utility (`clsx` + `tailwind-merge`).

## 5) Styling System

File: `app/globals.css`

- Imports Tailwind.
- Defines CSS custom properties for background/foreground/card/accent tokens.
- Includes dark-mode token overrides via `.dark`.
- Provides global and terminal-specific scrollbar styling.

## 6) Frontend Data Model Expectations

Dashboard defines local TypeScript interfaces matching backend response intent:

- `AgentTrace`
- `ExecutionResult`
- `ExecutionSummary`
- `ExecutionResponse`

These are currently duplicated in frontend instead of imported from a shared package.

## 7) Documentation and Agent Guidance Files

- `README.md`: default Next.js starter readme (not RelayX-specific).
- `AGENTS.md` and `CLAUDE.md`: assistant guidance files for this frontend workspace.
