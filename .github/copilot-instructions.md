# Project Guidelines

## Overview

This is a TypeScript project using ESM modules, Vitest for testing, ESLint + Prettier for code
quality, and nodemon/tsx for development.

## Commands

- `npm run build` — compile TypeScript
- `npm run start:dev` — start with hot reload
- `npm test` — run tests once
- `npm run test:watch` — watch tests
- `npm run test:coverage` — test with coverage
- `npm run lint` — lint the codebase
- `npm run format` — format code with Prettier

## Code Style

### Clean code principles

- Use meaningful names for variables, functions, parameters, and classes.
- Keep functions small and focused on a single responsibility.
- Extract magic numbers and strings into named constants.
- Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.
- Use fewer than three parameters when possible. If more are needed, use an options object.
- Avoid duplicated logic by extracting shared helper functions.
- Comment why a decision was made, not what the code already shows.

## Mandatory checklist

After any change, run these commands in order before considering the task done:

1. Review `README.md` and update it if the change affects documentation or usage.
2. `npm run lint`
3. `npm run build`

Fix any failures and rerun both commands before completing the task.

## TypeScript rules

- Use strict TypeScript and follow `tsconfig.json`.
- Prefer `interface` for object shapes and `type` for unions, intersections, and aliases.
- Avoid `any`; use `unknown` when the type is uncertain and narrow it explicitly.
- Use `const` by default, and use `let` only when reassignment is necessary.
- Prefer explicit return types on exported functions.
- Use ESM imports and exports.
- Prefer named exports over default exports.

## Naming conventions

| Construct              | Convention                      | Example                                 |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Variables / parameters | camelCase, descriptive nouns    | `userResponse`, `retryCount`            |
| Functions              | camelCase, verb phrases         | `fetchUserProfile`, `parseErrorMessage` |
| Classes / interfaces   | PascalCase                      | `HttpClient`, `UserRepository`          |
| Constants              | UPPER_SNAKE_CASE (module-level) | `MAX_RETRY_ATTEMPTS`                    |
| Types                  | PascalCase                      | `ApiResponse`, `RequestOptions`         |
| Files                  | kebab-case                      | `user-service.ts`, `parse-response.ts`  |

## Project conventions

- Keep all source code in `src/`.
- Prefer early returns to reduce nesting.

## HTTP requests

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

## CLI tools

- Use [Commander](https://www.npmjs.com/package/commander).
- The package entry point should match the project name and point to `dist/cli.js`.
- `cli.js` should construct and run the CLI.
- Include a `prepare` script that runs `npm run build` so local `npm link` works.

## Error handling

- Never swallow errors with empty `catch` blocks.
- Wrap third-party errors with context before rethrowing.
- Validate external inputs at system boundaries: API responses, environment variables, CLI args.

## Environment variables

- Prefer Node’s built-in `--env-file` when running Node directly.
- In production, inject environment variables from the hosting platform.
- Access `process.env` only through a validated config module.
- Fail fast if a required environment variable is missing.

## Testing

- Use Vitest and colocate test files with source files using `.spec.ts`.
- Write behavior-focused tests, not implementation tests.
- Prefer `vi.mock` for external dependencies and avoid mocking internals.
- Cover edge cases and error paths, not just the happy path.

## Backend

- Prefer TypeScript on Node.js for backend services.
- Use Fastify as the default HTTP framework.
- Keep architecture simple and modular; avoid heavy abstractions unless clearly required.
- Prefer schema-based request and response validation.
- Write small, focused route handlers and move business logic into separate services.
- Do not introduce NestJS, Express, or other frameworks unless explicitly requested or already in
  use.
- Favor clear types, explicit interfaces, and predictable module boundaries.
- Optimize for maintainability, testability, and low operational complexity.

## Frontend & Web UI

- For web UI work, prefer Web Components using TypeScript, semantic HTML, and Tailwind CSS.
- Build reusable UI elements as custom elements extending `HTMLElement`.
- The UI components should use DOM-safe text handling instead of a custom escaper.
- Use Shadow DOM only when style or DOM encapsulation is actually needed (for example, in widgets,
  dialogs, or form controls).
- Favor browser-native features such as `<template>`, `<slot>`, and declarative markup instead of
  heavy frontend frameworks.
- Do not introduce React, Vue, Angular, Svelte, or framework-specific tooling unless explicitly
  requested in the task.
- Keep components small, focused, and framework-independent; avoid recreating complex routing or
  global state systems.
- Prefer vanilla browser APIs and light utility helpers over large third-party UI libraries.
- Use Tailwind CSS utility classes for all styling; avoid writing custom CSS unless Tailwind cannot
  express the style.
- Design responsive layouts using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.); every
  UI must work on mobile, tablet, and desktop.
- Aim for a modern look: use consistent spacing, clear visual hierarchy, and subtle transitions
  where they aid usability.
- Follow accessible HTML patterns and include meaningful labels and ARIA attributes where
  appropriate.
