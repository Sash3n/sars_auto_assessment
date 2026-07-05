# SARS Auto-Assessment Calculator

A personal decision-support tool that independently estimates what a South African
individual's SARS annual assessment (ITA34) should look like, built from payslips and
other income and deduction inputs, so discrepancies in SARS's own auto-assessment can
be caught inside the 40-business-day correction window.

Not tax advice. Not affiliated with or endorsed by SARS.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) with React and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4 with [DaisyUI](https://daisyui.com/) v5,
  themed against the project's design reference (emerald primary, slate secondary,
  Inter for UI text, JetBrains Mono for currency values)
- [Vitest](https://vitest.dev/) and React Testing Library, with coverage thresholds
  enforced in CI
- GitHub Actions CI: lint, typecheck, test, build, `npm audit --audit-level=high`,
  CodeQL static analysis, and weekly Dependabot updates

## Running locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server                              |
| `npm run build`     | Production build                                  |
| `npm run start`     | Serve the production build                        |
| `npm run lint`      | ESLint over the whole repo                        |
| `npm run typecheck` | TypeScript, no emit                               |
| `npm test`          | Vitest, single run, with coverage thresholds      |
| `npm run test:watch`| Vitest in watch mode                              |

## Current state

Phase 0 (scaffold) is complete:

- Next.js + TypeScript + Tailwind + DaisyUI project setup.
- A light and a dark theme, both derived from the project's design reference rather
  than DaisyUI defaults. The user's choice persists in `localStorage`, falls back to
  the OS preference, and is resolved by an inline script before first paint so the
  wrong theme never flashes on load.
- CI pipeline and CodeQL analysis (see `.github/workflows/`).
- Project conventions in `AGENTS.md`, referenced by `CLAUDE.md`.
- Smoke tests covering the home page render and the theme toggle behaviour
  (`src/app/__tests__`, `src/components/__tests__`, `src/lib/__tests__`).

How it is tested: `npm test` runs the Vitest suite in jsdom. The theme module is
unit tested (storage, system fallback, applied-attribute precedence, failure paths)
and the toggle is exercised through Testing Library user events, asserting both the
`data-theme` attribute on `<html>` and the persisted value.

## Contributing

Read `AGENTS.md` first. In short: `main` -> `dev` -> `feature/*`, feature branches
are never deleted, every PR carries its own tests and a README update, no
`Co-Authored-By` trailers, no em dashes anywhere, and tax-engine work is test-first.

## Research links

Each feature PR adds the research links consulted for that change. Phase 0 has no
feature-specific research; this section grows from Phase 1 onward.
