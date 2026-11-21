# Project Guidelines

> **Forking this template?** Do this once, then delete this callout:
>
> 1. Rewrite Overview below — drop the "template repository" framing, describe this project
>    directly.
>
> 2. Delete "Structure & dependency graph" (Part A) and replace it with this repo's actual packages.
>
> 3. Rename all references to `typescript-template` to the project name.
>
> 4. Update start script so they point to the new entrypoint of the project.
>
> 5. Backend stack: keep the rule for the chosen stack in `.claude/rules/` (`backend-fastify.md` or
>    `backend-nest.md`) and delete the other — both match `apps/backend/**` and `apps/api/**`, so
>    keeping both loads conflicting rules. If the backend app lives elsewhere, add its folder to the
>    kept rule's `paths`. No backend at all: delete both and the "Backend / API apps" section.

## Overview

This is a **template repository**: it gets forked/copied and specialized into different kinds of
projects — CLI-only, backend-only, or fullstack (backend + frontend). It's a pnpm workspace monorepo
using ESM modules, Vitest for testing, oxlint + Prettier for code quality, and tsx for development.
`apps/*` holds executables/services and `packages/*` holds shared libraries, each with its own
`package.json`, `tsconfig.json`, and `src/`.

This file has two parts:

- **Part A** describes the repo exactly as it stands today — always applicable.

- **Part B** is conditional guidance for capabilities this template doesn't have yet (an HTTP
  backend, a web frontend, outbound HTTP calls). Follow it once that capability is actually added —
  it is not a description of current code, and its absence today doesn't mean it's discouraged.

# Part A — Current state

## Structure & dependency graph

Four workspace packages exist today, wired together via pnpm's `workspace:*` protocol:

- `apps/cli` (`@carlba/cli`) — bin app (`cli` → `dist/cli.js`), built with Commander. Depends on
  `core`, `config`, `logger`.

- `packages/core` (`@carlba/core`) — shared library, e.g. `GreetingService`. Depends on `logger`.
  Only holds code that's actually shared by more than one app — code used by a single app belongs in
  that app's own `src/`, not here.

- `packages/logger` (`@carlba/logger`) — pino wrapper. Exports `createLogger(...)` and the `Logger`
  type. No internal deps (leaf).

- `packages/config` (`@carlba/config`) — zod-based env parsing. Exports `getConfig`, `initConfig`,
  `parseConfig`. No internal deps (leaf).

Dependency graph: `cli → core, config, logger`; `core → logger`.

## Commands

Run from the repo root; they fan out across all workspace packages via pnpm:

- `pnpm run build` — compile TypeScript in every package (`pnpm -r run build`)

- `pnpm run start` / `pnpm run start:dev` — run the CLI / run it with hot reload

- `pnpm test` — run tests once across every package (`pnpm -r run test`)

- `pnpm run test:coverage` — test with coverage

- `pnpm run lint` — lint the codebase (`oxlint --type-aware`, config in `.oxlintrc.json`)

- `pnpm run format` / `pnpm run format:check` — format code with Prettier

- `pnpm run dependency:update` — `pnpm up -r --latest`, excluding `typescript`, `vitest`,
  `@types/node`

Use `pnpm --filter <package-name> <script>` to target a single workspace package, e.g.
`pnpm --filter @carlba/core test` or `pnpm --filter @carlba/cli build`.

## Adding a new package

- Executable or service → `apps/<name>`. Shared library consumed by other packages →
  `packages/<name>`. No registration step beyond creating the directory — `pnpm-workspace.yaml`
  already globs `apps/*` and `packages/*`.

- Only put code in `packages/*` once it's actually used by more than one app. Code used by a single
  app stays in that app's own `src/` until a second consumer appears — don't pre-extract "shared"
  packages speculatively.

- `package.json`: scope the name `@carlba/<name>`, `"type": "module"`, `"private": true`. Declare
  internal dependencies as `"@carlba/other": "workspace:*"`. Libraries need `main`/`types`/`exports`
  pointing at `dist/`; bin apps need a `bin` field instead.

- `tsconfig.json`:
  `{ "extends": "../../tsconfig.json", "compilerOptions": { "rootDir": "./src", "outDir": "./dist" }, "include": ["src"] }`.
  Libraries also set `declaration: true, declarationMap: true`.

- `vitest.config.ts`: copy the shape used by all four existing packages — `environment: 'node'`, v8
  coverage with `text`/`json`/`html` reporters, `dir: 'src'`.

## Shared packages

New apps should bootstrap config and logging through `@carlba/config` and `@carlba/logger` rather
than reading `process.env` or instantiating `pino` directly. This is the real pattern from
`apps/cli/src/cli.ts` and `apps/cli/src/schema.ts`:

```ts
// schema.ts
export const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
    LOG_LEVEL: z
      .string()
      .trim()
      .default('debug')
      .pipe(z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV !== 'production',
    logLevel: raw.LOG_LEVEL,
  }));
```

```ts
// cli.ts
import { getConfig } from '@carlba/config';
import { createLogger } from '@carlba/logger';
import { envSchema } from './schema.js';

const config = getConfig(envSchema); // throws on invalid env
const logger = createLogger(undefined, config.NODE_ENV, { level: config.logLevel }).child({
  name: 'typescript-template-cli',
});
```

`getConfig` throws on invalid input — use it when startup should fail loudly. `initConfig` instead
logs and calls `process.exit(1)` — use it when you want a clean CLI/process exit rather than an
uncaught exception.

Services and domain logic should throw `ApiError` (`@carlba/core`, `packages/core/src/errors.ts`)
rather than plain `Error`s. Packages can inherit from `ApiError` and create more specific errors if
needed.

```ts
import { ApiError } from '@carlba/core';

throw new ApiError(`User not found: id=${userId}`, { statusCode: 404, cause: originalError });
```

- `statusCode` is loosely based on HTTP status codes since that's a well-known, well-understood
  scale — it doesn't imply the error is HTTP-specific.

- `ApiError` should be caught by global error handling (a Fastify error handler, a CLI top-level
  catch, etc.), not by the code that throws it.

- The consumer/global handler decides how to present the error to the end user — services and domain
  logic just throw with an accurate `statusCode` and message; they shouldn't format a response
  themselves.

- When throwing errors be descriptive in the error message, include a statusCode matching the
  situation. If the ApiError was caused by another error then include that error as the cause.

### Formatting `ApiError` messages

A global handler only sees the error, not the code path that led to it — the stack trace shows where
`ApiError` was constructed, but not _which_ input or entity was involved. The message is the only
situational context that survives, so it must carry the specifics:

- Include the identifying data in the message, not a generic phrase:
  `` `User not found: id=${userId}` `` rather than `'User not found'`. Prefer `key=value` pairs for
  the identifying data so messages stay greppable in logs.

- When wrapping a lower-level error (a DB error, a failed `got` request, etc.), pass it as `cause`
  rather than discarding it, so both stacks are preserved:

  ```ts
  try {
    return await db.users.findById(userId);
  } catch (dbError) {
    throw new ApiError(`Failed to load user: id=${userId}`, { statusCode: 404, cause: dbError });
  }
  ```

  Pino's default serializer includes `cause` when logging the error (see the Fastify error handler
  below), so the log shows the full chain instead of just the outer `ApiError`.

- Never put user-facing formatting in the message (no trailing punctuation styling, no HTML) — the
  consumer decides how to present it; the message is for logs and developers.

## Loading `.env` files

Use Node's native `--env-file-if-exists` flag (Node 20.6+; `tsx` passes it straight through to Node,
since it's a runtime flag, not a `tsx`-specific one) on every script that runs the app's entry file:

```json
"start": "tsx --env-file-if-exists=../../.env dist/cli.js",
"start:dev": "tsx --env-file-if-exists=../../.env src/cli.ts"
```

## TypeScript & code style

### Clean code principles

- Use meaningful names for variables, functions, parameters, and classes.

- Keep functions small and focused on a single responsibility.

- Extract magic numbers and strings into named constants.

- Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.

- Use fewer than three parameters when possible. If more are needed, use an options object.

- Avoid duplicated logic by extracting shared helper functions.

- Comment why a decision was made, not what the code already shows.

### TypeScript rules

- Use strict TypeScript and follow the root `tsconfig.json` (extended by every package).

- Prefer `interface` for object shapes and `type` for unions, intersections, and aliases.

- Avoid `any`; use `unknown` when the type is uncertain and narrow it explicitly.

- Use `const` by default, and use `let` only when reassignment is necessary.

- Prefer explicit return types on exported functions.

- Use ESM imports and exports (`verbatimModuleSyntax` is on — include file extensions in relative
  imports, e.g. `./schema.js`).

- Prefer named exports over default exports.

### Naming conventions

| Construct              | Convention                      | Example                                 |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Variables / parameters | camelCase, descriptive nouns    | `userResponse`, `retryCount`            |
| Functions              | camelCase, verb phrases         | `fetchUserProfile`, `parseErrorMessage` |
| Classes / interfaces   | PascalCase                      | `HttpClient`, `UserRepository`          |
| Constants              | UPPER_SNAKE_CASE (module-level) | `MAX_RETRY_ATTEMPTS`                    |
| Types                  | PascalCase                      | `ApiResponse`, `RequestOptions`         |
| Files                  | kebab-case                      | `user-service.ts`, `parse-response.ts`  |

## Testing

- Use Vitest and colocate test files with source files using `.spec.ts` (e.g. `greet.ts` +
  `greet.spec.ts`).

- Write behavior-focused tests, not implementation tests.

- Prefer `vi.mock` for external dependencies and avoid mocking internals.

- Cover edge cases and error paths, not just the happy path.

- Each package runs its own Vitest config — there is no aggregated root test runner beyond
  `pnpm -r run test`.

## Error handling

- Never swallow errors with empty `catch` blocks.

- Wrap third-party errors with context before rethrowing.

- Validate external inputs at system boundaries: API responses, environment variables, CLI args.

## Verification checklist

Before considering a change done:

1. `pnpm run lint`, `pnpm run test`, `pnpm run build` from root (or the `pnpm --filter <pkg> ...`
   equivalents when working in a single package).

2. Update `README.md` if the change affects documented usage or structure.

# Part B — Conditional conventions

These apply once the corresponding capability is added to the template. Follow them at that point;
their absence today isn't a signal to avoid them.

## CLI apps

Applies to any `apps/*` package that is a command-line tool — already true for `apps/cli`, and the
template for future CLI apps.

- Use [Commander](https://www.npmjs.com/package/commander).

- The package's `bin` entry should match the project name and point to `dist/cli.js`.

- The entry file (`cli.ts`) should construct and run the `Command` program; put each subcommand in
  a domain appropriate folder (see `apps/cli/src/greet/greet-command.ts` as the template) and
  register it from the entry file.

- Include a `prepare` script that runs the package's build so `npm link`/`pnpm link` works locally.

- Bootstrap config/logging via `@carlba/config` + `@carlba/logger`, as shown above.

- Keep business logic out of command files (`src/<domain>/*-command.ts`) and in plain classes/functions
  (e.g. `src/greeting`'s `GreetingService`) that take their dependencies as constructor/function
  params — commands stay thin, parsing args and formatting output. Wire dependencies by hand in
  `cli.ts` and pass them down explicitly; do not introduce InferDI or any DI container here. A CLI
  invocation is a single-shot process with no per-request scope to manage, so a container adds
  indirection without solving a problem — InferDI is a Part B backend/API convention for managing
  per-request scope in a long-running server, which doesn't apply here.

## HTTP client usage

_Applies whenever any package needs to make outbound HTTP calls._

- Use [`got`](https://github.com/sindresorhus/got) as the HTTP client.

- Do not use `fetch`, `axios`, or `node-fetch`.

- Prefer `got.extend()` for shared base URLs, headers, and retry logic.

- Type responses with `got<ResponseType>(url, options)`.

- Catch `HTTPError` and rethrow it with contextual information.

```ts
import got, { HTTPError } from 'got';

const apiClient = got.extend({
  prefixUrl: 'https://api.example.com',
  responseType: 'json',
});

async function fetchUser(userId: string): Promise<User> {
  try {
    return await apiClient.get<User>(`users/${userId}`).json();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`Failed to fetch user ${userId}: ${error.response.statusCode}`);
    }
    throw error;
  }
}
```

## Backend / API apps

_Applies when this template is specialized into a project with an HTTP backend — e.g. a future
`apps/backend` package._

There are two supported stacks, each with its own path-scoped rule in `.claude/rules/`. The rule
loads automatically when a matching file is read or edited; before scaffolding a new backend app,
read the rule for the chosen stack first:

- Fastify + InferDI: `.claude/rules/backend-fastify.md`

- NestJS: `.claude/rules/backend-nest.md`

The conventions below apply to both stacks.

- Prefer TypeScript on Node.js for backend services.

- Pick exactly one stack per backend app. Do not mix Fastify + InferDI with NestJS in one app, and
  do not introduce other frameworks (e.g. plain Express) unless explicitly requested.

- Services and domain logic throw `ApiError` (`@carlba/core`, see Shared packages above)

- Config and logging bootstrap is stack-specific: Fastify apps use `@carlba/config` +
  `@carlba/logger` as shown above; NestJS apps use `@nestjs/config` and `nestjs-pino` (see the
  stack's rule file). Either way, no ad hoc `process.env` usage or hand-built `pino` instances.

- Always configure database access via a single full connection URI (e.g. `DATABASE_URL`,
  `postgresql://user:password@host:5432/dbname`) rather than separate `DB_HOST`/`DB_PORT`/`DB_USER`/
  `DB_PASSWORD`/`DB_NAME` variables. Validate it as one `z.string().url()` (or driver-specific
  refinement) field in the zod env schema and pass it straight to the DB client/driver, which
  already accepts a URI — don't split it apart and reassemble it. A single var is easier to rotate,
  matches what most hosting providers (Render, Railway, Neon, RDS, Docker Compose, etc.) inject, and
  avoids the schema drifting out of sync with the driver's own URI parsing.

- Favor clear types, explicit interfaces, and predictable module boundaries.

- Optimize for maintainability, testability, and low operational complexity.

- Add a `.http` file for the project with examples on how to interact with the API. The format
  should be in [httpYac](https://httpyac.github.io) format

  ```http
  ### List all X Entities
  @app_token = {{$dotenv APP_TOKEN}}
  POST http://homeassistant:8123/api/services/homeassistant/reload_all
  Authorization: Bearer {{app_token}}
  Content-Type: application/json

  ### Description
  @app_token = {{$dotenv APP_TOKEN}}
  POST http://homeassistant`:8123/api/services/homeassistant/restart
  Authorization: Bearer {{hass_token}}
  Content-Type: application/json
  ```

## Frontend / Web UI apps

_Applies when this template is specialized into a fullstack project with a web UI — e.g. a future
`apps/frontend` package._

- Use React with TypeScript as the standard for all web UI work.

- Use [shadcn/ui](https://ui.shadcn.com) as the primary component library; add components via
  `npx shadcn@latest add <component>` and own the generated source in `src/components/ui/`.

- Use Tailwind CSS utility classes for all styling; avoid plain CSS files unless Tailwind cannot
  express the style.

- Use shadcn/ui's built-in CSS variables and `tailwind.config` theme extension to define colors,
  typography, and spacing consistently; do not hardcode color values.

- Design responsive layouts using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.); every
  UI must work on mobile, tablet, and desktop.

- Do not introduce MUI, Chakra UI, Ant Design, or other component libraries unless explicitly
  requested.

- Keep components small and focused on a single responsibility; move business logic into custom
  hooks or service modules.

- Use React Router for client-side routing when navigation is required. If query params are used,
  use the [`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams) hook.

- Prefer functional components and React hooks; do not use class components.

- Lift state only as far as needed; prefer local component state or context over global state
  libraries unless the app clearly requires it.

- Follow accessible HTML patterns; shadcn/ui is built on Radix UI primitives which provide ARIA
  support — supplement with explicit labels where needed.
