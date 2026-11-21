---
paths:
  - 'apps/backend/**'
  - 'apps/api/**'
---

# Backend / API apps — NestJS

_Applies to a backend app built on NestJS. Also follow the common rules in the root `CLAUDE.md`
("Backend / API apps"). The `paths` above assume the app lives in `apps/backend` or `apps/api` —
add its folder if it has another name._

- Nest is usually newer than training data. Follow the official Nest agent skills (installed and
  updated with `npx @nestjs/skills add --agent all`) and the app's `AGENTS.md` for how to write Nest
  code. This file only adds this repo's conventions on top of them.

- Scaffold and extend with the Nest CLI (`nest new`, `nest g ...`) rather than hand-creating modules,
  controllers, and services.

- Use Nest's own DI container with class-based providers and constructor injection. Do not use
  InferDI in a Nest app.

- Bootstrap config and logging from `@carlba/config` and `@carlba/logger` by exposing them as Nest
  providers, rather than reading `process.env` directly or instantiating `pino`.

- Services throw `ApiError`. Register one global exception filter (`@Catch()`, registered via
  `APP_FILTER`) that turns `ApiError`, validation errors, and unknown errors into HTTP responses.
  Controllers and services do not catch and format errors themselves.

- Validate request input with zod through Nest's Standard Schema support
  (`StandardSchemaValidationPipe` with `@Body({ schema })` / `@Param('id', { schema })`), not
  `class-validator` DTOs.
