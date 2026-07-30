# Convert to pnpm Monorepo: `apps/cli` + `packages/core`

## Context

The repo is currently a single-package npm project (root `src/`, root `tsconfig.json`/`eslint.config.js`/`vitest.config.ts`, `tsc` build, Dockerfile targeting `dist/index.js`). The user wants to introduce monorepo tooling and add exactly one new capability: a CLI tool that greets the user, built on a shared `GreetingService`.

**Scope is intentionally narrow** (per user's answers):
- Only `apps/cli` and `packages/core` are being added.
- The existing root backend code (`src/`) is explicitly **out of scope** — it stays exactly where it is, untouched, still building/testing/linting/deploying as it does today.
- No `packages/tsconfig` or `packages/eslint-config` — the new packages reuse the existing root configs directly.
- No prior attempt is being resumed. A local, untracked, incomplete attempt at this same idea was found on disk (`packages/cli/dist`, `packages/shared/dist`, and stale `node_modules/@carlba/*` symlinks — compiled output only, no source, not in git). Per user instruction, this is discarded, not resumed.

Package manager: **pnpm** (switching from npm). Package scope: **`@carlba`**, matching the repo's existing GitHub owner (`carlba/typescript-template`), so `apps/cli` → `@carlba/cli` and `packages/core` → `@carlba/core`.

## Decisions locked in with the user

| Question | Decision |
|---|---|
| Package manager | pnpm workspaces (migrate off npm) |
| GreetingService location | `packages/core` (shared package), not inside `apps/cli` |
| Existing backend/root `src/` | Untouched — out of scope |
| CLI execution | Real `bin` entry (installable/linkable executable), per `.github/copilot-instructions.md` CLI conventions |
| CLI behavior | Accepts an optional name argument/flag; falls back to a default greeting if omitted |
| Shared tooling (tsconfig/eslint/vitest) | New packages extend/reuse the **existing root configs** — no new shared-config packages |
| Stale local artifacts | Delete `packages/cli/dist`, `packages/shared/dist`, `node_modules/@carlba/cli`, `node_modules/@carlba/shared` before starting |
| Package naming/scope | `@carlba/cli`, `@carlba/core` |
| pnpm version pin | Add `packageManager: "pnpm@<version>"` to root `package.json` (Corepack-pinned) |
| CLI command name | `cli`, with `greet` as a subcommand (invoked as `cli greet --name <name>`) |

## Conventions to follow (from `.github/copilot-instructions.md`)

- **CLI**: use **Commander**. Package entry point matches project name, points to `dist/cli.js`. `cli.js` constructs and runs the CLI. Include a `prepare` script running `npm run build` (translate to the package's own build) so `npm link`/`pnpm link` works locally.
- **Naming**: files kebab-case (`greeting-service.ts`), classes/interfaces PascalCase (`GreetingService`).
- **Errors**: don't swallow errors; validate external inputs (CLI args) at the boundary.
- Tests are colocated using `.spec.ts` suffix (matches existing `src/index.spec.ts`, `src/registry.spec.ts` pattern) — apply the same convention in the new packages.
- No direct `process.env` access outside a config module (existing ESLint rule) — irrelevant to a simple CLI unless it later reads env vars.

## Target structure (additive only)

```
.
├─ package.json                  # becomes pnpm workspace root; existing root src/ build untouched
├─ pnpm-workspace.yaml           # new: packages: [apps/*, packages/*]
├─ pnpm-lock.yaml                # new: replaces package-lock.json
├─ tsconfig.json                 # existing root config — reused/extended, not replaced
├─ eslint.config.js              # existing root config — extended to cover apps/**, packages/**
├─ vitest.config.ts              # existing root config — extended to include apps/**, packages/** test dirs, OR left as-is if workspaces run their own vitest
├─ apps/
│  └─ cli/
│     ├─ package.json            # @carlba/cli, bin -> dist/cli.js, depends on @carlba/core (workspace:*)
│     ├─ tsconfig.json           # extends root ../../tsconfig.json, its own rootDir/outDir
│     └─ src/
│        ├─ cli.ts               # Commander program entry (shebang, calls run())
│        ├─ commands/
│        │  └─ greet.ts          # registerGreetCommand(program) using GreetingService
│        └─ commands/greet.spec.ts
└─ packages/
   └─ core/
      ├─ package.json            # @carlba/core, no bin, plain library
      ├─ tsconfig.json           # extends root ../../tsconfig.json
      └─ src/
         ├─ index.ts             # export { GreetingService } from './services/greeting-service.js'
         ├─ services/
         │  └─ greeting-service.ts
         └─ services/greeting-service.spec.ts
```

Existing root `package.json`'s scripts (`build`, `test`, `lint`, etc.) keep operating on root `src/` exactly as today — they are not repointed to workspaces. New root scripts are **added** (not replacing existing ones) to drive the workspaces via pnpm filters.

## Implementation steps

1. **Clean up stale local artifacts** (untracked, pre-existing on disk, not from this session):
   - Remove `packages/cli/dist`, `packages/shared/dist`
   - Remove symlinks `node_modules/@carlba/cli`, `node_modules/@carlba/shared`

2. **Switch to pnpm workspaces**
   - Add `pnpm-workspace.yaml`:
     ```yaml
     packages:
       - 'apps/*'
       - 'packages/*'
     ```
   - Add `"packageManager": "pnpm@<latest-10.x>"` to root `package.json`.
   - Run `pnpm import` (converts `package-lock.json` → `pnpm-lock.yaml`) or a fresh `pnpm install`; remove `package-lock.json` once `pnpm-lock.yaml` is verified.
   - Root `package.json` gains `"private": true` if not already set, plus new orchestration scripts (see below) — existing scripts untouched.

3. **Create `packages/core`** (`@carlba/core`)
   - `package.json`: name `@carlba/core`, `type: module`, `main`/`exports` pointing at `dist/index.js`, `types` at `dist/index.d.ts`, scripts `build` (`tsc`), `test` (`vitest run`), `lint` (`eslint .`).
   - `tsconfig.json`: `{ "extends": "../../tsconfig.json", "compilerOptions": { "rootDir": "./src", "outDir": "./dist" }, "include": ["src"] }`.
   - `src/services/greeting-service.ts`: kebab-case file, PascalCase class:
     ```ts
     export class GreetingService {
       create(name?: string): string {
         return `Hello, ${name ?? 'world'}!`;
       }
     }
     ```
   - `src/services/greeting-service.spec.ts`: vitest spec covering default and named greeting.
   - `src/index.ts`: re-export `GreetingService`.

4. **Create `apps/cli`** (`@carlba/cli`)
   - `package.json`: name `@carlba/cli`, `bin: { "cli": "dist/cli.js" }`, `dependencies: { "@carlba/core": "workspace:*", "commander": "^..." }`, scripts `build` (`tsc`), `prepare` (`npm run build` equivalent, e.g. `pnpm run build`), `test`, `lint`, and a dev script (`tsx src/cli.ts`) mirroring root's `start:dev` pattern.
   - `tsconfig.json`: extends root, own `rootDir`/`outDir`.
   - `src/cli.ts`: shebang `#!/usr/bin/env node`, builds `new Command().name('cli').description(...).version(...)`, registers `registerGreetCommand(program)` as a `greet` subcommand (invoked as `cli greet --name Carl`), calls `program.parse()`.
   - `src/commands/greet.ts`: Commander subcommand accepting an optional `--name <name>` option; instantiate `new GreetingService()` from `@carlba/core`; write `greetingService.create(name)` to stdout.
   - `src/commands/greet.spec.ts`: test the command logic (extract testable logic from the Commander wiring where reasonable).

5. **Wire shared root config to cover new packages**
   - `eslint.config.js`: confirm `files: ['**/*.{ts,tsx}']` glob already matches `apps/**` and `packages/**` (flat config is repo-root-relative by default, so likely no change needed beyond removing any accidental root-only path restriction).
   - `vitest.config.ts`: current config uses `dir: 'src'` which only picks up root tests. Decide whether to broaden root vitest to also discover `apps/*/src` and `packages/*/src`, or give each workspace package its own minimal `vitest.config.ts` that reuses shared options. Given "reuse root configs" was the decision, prefer broadening the root config's `dir`/`include` rather than duplicating config files, if vitest supports it cleanly for a multi-root layout — otherwise each package gets a thin config that just imports/extends the root one.
   - Root `tsconfig.json` is left as the base; it is not converted to a project-references solution-style file (out of scope — no build orchestration complexity requested). Each new package's `tsconfig.json` uses a relative `extends` to the root file.

6. **Add root orchestration scripts** (additive, existing scripts untouched):
   ```json
   {
     "scripts": {
       "cli:build": "pnpm --filter @carlba/cli build",
       "cli:dev": "pnpm --filter @carlba/cli dev"
     }
   }
   ```
   (Exact script names to be finalized during implementation; kept minimal per narrow scope.)

7. **Update `.gitignore`** if needed to ensure `apps/*/dist`, `packages/*/dist` are covered (existing `dist` pattern should already match at any depth, but verify).

8. **Do not touch**: root `src/`, `Dockerfile`, `.github/workflows/ci.yml`/`publish.yml`, `.nvmrc`. These continue to build/test/deploy the existing root package exactly as before. (CI will need `pnpm/action-setup` eventually if workspace scripts are added to CI, but since scope excludes touching CI, this is left as a known follow-up, not part of this plan.)

## Verification

1. `pnpm install` at root succeeds with the new workspace layout.
2. `pnpm --filter @carlba/core build && pnpm --filter @carlba/core test` — `GreetingService` unit tests pass.
3. `pnpm --filter @carlba/cli build` succeeds, producing `apps/cli/dist/cli.js`.
4. `pnpm --filter @carlba/cli exec cli greet --name Carl` (or `node apps/cli/dist/cli.js greet --name Carl`) prints a greeting containing "Carl"; running `cli greet` with no `--name` prints the default greeting.
5. `pnpm -w run lint` (or existing root `lint` script extended) passes for `apps/**` and `packages/**` with zero new ESLint errors.
6. Confirm existing root `npm`/`pnpm` scripts (`build`, `test`, `lint` on root `src/`) still work unmodified — the original backend behavior is unaffected.
7. `git status` shows only intended new files (`apps/`, `packages/`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, modified root `package.json`) — no leftover stale artifacts from the prior attempt.
