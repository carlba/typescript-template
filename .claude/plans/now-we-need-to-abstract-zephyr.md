# Create root `CLAUDE.md`

## Context

This repo is a **template** repository: it gets forked/copied and specialized into different kinds of projects — CLI-only, backend-only, or fullstack (backend + frontend). It was recently converted from a single-package npm project into a pnpm workspace monorepo (`apps/*` + `packages/*`). No `CLAUDE.md` exists yet. There's an existing `.github/copilot-instructions.md` (195 lines) with generally good conventions, but it predates the finished monorepo (missing 2 of the 4 current packages, doesn't describe the workspace structure) and mixes "what this repo currently has" with "conventions to follow if you build a backend/frontend/HTTP client" without distinguishing the two.

The user wants a **new, single root `CLAUDE.md`** (not a copy of the Copilot file, though it should pull in the still-good pieces) that:
- Accurately documents the current monorepo state (structure, packages, commands) as ground truth.
- **Also** carries forward the backend (Fastify+zod), frontend (React+shadcn+Tailwind), and HTTP client (`got`) conventions from the Copilot file — adapted for the monorepo (e.g., "this is what a new `apps/api` or `apps/web` package should look like"), not dropped just because no such package exists yet.
- Clearly labels which sections describe the repo as it stands today vs. which are conditional guidance for when a given project type/capability is added — so Claude doesn't confuse "not yet used" with "not allowed."

Single root file, no nested per-package `CLAUDE.md` — nothing in the current structure warrants one.

## Ground truth (verified on disk)

- **Workspace**: `pnpm-workspace.yaml` → `apps/*`, `packages/*`. Root `package.json`: `private: true`, `type: module`, `packageManager: pnpm@11.5.1`, no root source code (no `src/`, no `main`/`bin`).
- **Root scripts** (all fan out via `pnpm -r` / `pnpm --filter`):
  - `build` → `pnpm -r run build`
  - `test` → `pnpm -r run test`
  - `test:coverage` → `pnpm -r run --if-present test:coverage`
  - `start` / `start:dev` → `pnpm --filter @carlba/cli start` / `start:dev`
  - `lint` → `eslint .` (single flat config, repo-wide, covers `apps/**` + `packages/**` automatically)
  - `format` / `format:check` → `prettier --write .` / `--check .`
  - `dependency:update` → `pnpm up -r --latest` (excludes typescript/vitest/@types/node)
  - Target one package: `pnpm --filter <pkg-name> <script>`, e.g. `pnpm --filter @carlba/core test`.
- **Four packages today**, dependency graph via `workspace:*`:
  - `apps/cli` (`@carlba/cli`) — bin app, `bin: { cli: dist/cli.js }`, Commander-based (`src/cli.ts` entry, `src/commands/greet.ts`), depends on `core`, `config`, `logger`.
  - `packages/core` (`@carlba/core`) — library, `GreetingService`, depends on `logger`.
  - `packages/logger` (`@carlba/logger`) — leaf, pino wrapper. Exports `createLogger(nameParts?, environment?, pinoLoggerOptions?)` and `Logger` type. No workspace deps.
  - `packages/config` (`@carlba/config`) — leaf, zod-based env parsing. Exports `getConfig(schema, env?)` (throws on invalid) and `initConfig(schema, logger)` (logs + `process.exit(1)` on invalid) and `parseConfig`. No workspace deps.
  - Every package: `type: module`, own `tsconfig.json` (`extends: ../../tsconfig.json`), own `vitest.config.ts` (all four byte-identical: `environment: node`, v8 coverage reporters `text/json/html`, `dir: 'src'`), tests colocated as `*.spec.ts`.
- **Real usage pattern** (from `apps/cli/src/cli.ts` + `apps/cli/src/schema.ts`) — this is the canonical example to quote for "how a new app should bootstrap config + logging":
  ```ts
  import { getConfig } from '@carlba/config';
  import { createLogger } from '@carlba/logger';
  import { envSchema } from './schema.js';

  const config = getConfig(envSchema); // throws on invalid env
  const logger = createLogger(undefined, config.NODE_ENV, { level: config.logLevel })
    .child({ name: 'typescript-template-cli' });
  ```
  ```ts
  // schema.ts
  export const envSchema = z.object({
    NODE_ENV: z.string().trim().default('development').pipe(z.enum(['production','development','test'])),
    LOG_LEVEL: z.string().trim().default('debug').pipe(z.enum(['trace','debug','info','warn','error','fatal'])),
  }).transform(raw => ({ NODE_ENV: raw.NODE_ENV, isDevelopment: raw.NODE_ENV !== 'production', logLevel: raw.LOG_LEVEL }));
  ```
- **Root `tsconfig.json`**: extends `@tsconfig/node24/tsconfig.json`, `moduleResolution: nodenext`, `verbatimModuleSyntax: true` — base all packages inherit.
- **No** turborepo/nx/Makefile — plain pnpm recursive scripting only. **No** root vitest config or `vitest.workspace.ts`. **No** husky/lint-staged/commitlint.
- **CI** (`.github/workflows/ci.yml`): pnpm-aware already (`pnpm/action-setup`, `pnpm install --frozen-lockfile`, root `lint`/`test`/`build`). **Docker**: `pnpm install --frozen-lockfile && pnpm run build`, `ENTRYPOINT ["node", "apps/cli/dist/cli.js"]`. Document as-is, no changes needed.
- **Stale, out of scope to fix**: `.stackblitzrc` still says `npm run ...`; root `README.md` is 3 lines, doesn't mention monorepo structure.

## Section plan for `CLAUDE.md`

Two-tier structure: **Part A** describes the repo as it exists right now (always true). **Part B** is explicitly labeled conditional guidance — conventions to follow *when* a given project type or capability is added to the template, ported from `copilot-instructions.md` and adapted to monorepo paths/packages. Each Part B subsection opens with a one-line trigger (e.g. "Applies when this template is specialized into a project with an HTTP backend").

### Part A — Current state (always applicable)

1. **Overview** — pnpm workspace monorepo template, ESM, `apps/*` = executables/services, `packages/*` = shared libraries, Node 24, TypeScript strict. Note explicitly: this repo is a template meant to be specialized (CLI / backend / fullstack); Part B below covers conventions for capabilities not yet present.
2. **Structure & dependency graph** — the 4 packages, one line each, `workspace:*` arrows (cli → core, config, logger; core → logger).
3. **Commands** — root scripts table + `pnpm --filter <pkg> <script>` targeting.
4. **Adding a new package** — `apps/*` (executable/service) vs `packages/*` (shared library); required files (`package.json` with `workspace:*` internal deps, `tsconfig.json` extending root, `vitest.config.ts` matching the existing 4-package shape); no registration needed beyond the workspace glob.
5. **Shared packages** — `@carlba/logger` (`createLogger`) and `@carlba/config` (`getConfig`/`initConfig`) usage, quoting the real `apps/cli/src/cli.ts` + `schema.ts` snippet above as the canonical bootstrap pattern any new app should follow instead of ad hoc `pino`/`process.env`.
6. **TypeScript & code style** — merged from Copilot file: clean-code principles (meaningful names, small functions, extract magic numbers, positive conditionals, ≤3 params, no duplicated logic, comment the why), TS rules (strict, `interface` vs `type`, avoid `any`, `const` by default, explicit return types on exports, ESM, named exports), naming conventions table (camelCase/PascalCase/UPPER_SNAKE_CASE/kebab-case).
7. **Testing** — Vitest, colocated `.spec.ts`, behavior-focused, `vi.mock` externals, per-package config, no aggregated root test runner beyond `pnpm -r run test`.
8. **Error handling** — no empty catches, wrap third-party errors with context, validate external input at boundaries.
9. **Verification checklist** — `pnpm run lint`, `pnpm run test`, `pnpm run build` (or `pnpm --filter <pkg> ...` equivalents) before considering a change done; update `README.md` if usage/structure changed.

### Part B — Conditional conventions (labeled by trigger)

10. **CLI apps** *(applies to any `apps/*` package that is a command-line tool — already true for `apps/cli`, and the template for future CLI apps)* — Commander, bin name matches project name → `dist/cli.js`, entry file constructs/runs the program, subcommands as separate files (reference `apps/cli/src/commands/greet.ts` as the template), `prepare` script for `npm/pnpm link` support.
11. **HTTP client usage** *(applies whenever any package needs to make outbound HTTP calls)* — use [`got`](https://github.com/sindresorhus/got), not `fetch`/`axios`/`node-fetch`; `got.extend()` for shared base URL/headers/retry; type responses with `got<T>(...)`; catch `HTTPError` and rethrow with context. Carry the existing code example from `copilot-instructions.md` (adapt import style to repo's ESM/verbatim-module-syntax conventions if needed).
12. **Backend / API apps** *(applies when the template is specialized into a project with an HTTP backend, e.g. a future `apps/api`)* — Fastify as default framework, zod route validation via `fastify-type-provider-zod` (carry the existing example), `HttpError` extending `Error` with `statusCode` (capturing stack trace), route handlers thin / business logic in services, services convert errors to `HttpError`s, config/logging via `@carlba/config` + `@carlba/logger` (not ad hoc), no NestJS/Express unless explicitly requested.
13. **Frontend / Web UI apps** *(applies when the template is specialized into a fullstack project with a web UI, e.g. a future `apps/web`)* — React + TypeScript, shadcn/ui + Tailwind (own the generated `src/components/ui/` source, no hardcoded colors, use theme extension), responsive via Tailwind prefixes, React Router (+ `useSearchParams` hook for query params) when navigation needed, functional components/hooks only, local/context state preferred over global state libs, accessible HTML (shadcn/Radix ARIA support + explicit labels). No MUI/Chakra/Ant unless explicitly requested.

## Verification

- Every command mentioned in Part A actually exists in some `package.json` — spot-check against root `package.json` and the 4 workspace `package.json` files.
- Part A contains no reference to `got`, Fastify, or React — those live only in Part B, clearly labeled conditional.
- Part B sections are unmistakably marked as "when X is added" rather than phrased as current-state fact, so Claude doesn't assume a backend or frontend already exists in this repo.
- Naming/TS-rules/testing sections match actual code (spot-checked already: `packages/config/src/config.ts`, `packages/logger/src/logger.ts` both follow the stated conventions).
