# Repository Guidelines

Memobot is a Telegram and WhatsApp bot built on Google Cloud Platform that uses a Spaced Repetition System (SRS) for information retention, with AI features powered by Vertex AI (Gemini 2.0 Flash).

## Project Structure & Module Organization

- **src/scheduler/**: Custom SRS engine. `scheduler.ts` decouples timing from execution; `storage/` and `queue/` are pluggable backends — Google Cloud Tasks is the default queue.
- **src/bot/**: Bot logic and SRS timetables (`timetable.ts` differs per environment).
- **src/db/**: Persistence layer mixing Firestore (chats, messages) and Prisma/PostgreSQL (words, quizzes, scheduler storage).
- **src/messengers/**: Platform adapters — `tg/` (Telegraf) and `whatsAppMessenger.ts`.
- **src/services/**: AI mnemonic generation (`ai-model.ts`), image rendering, text-to-speech.
- **src/functions/**: GCP Cloud Function entry points (`telegram.ts`, `whatsapp.ts`).
- **src/api/commands/**: Bot command handlers (`init`, `quiz`, `word`, `practice`, etc.).
- **prisma/**: Schema, migrations, and generated client (`client/`).
- **configs/**: `esbuild.mjs` bundle config; runtime `.env` is read from here.

## Build, Test, and Development Commands

- `yarn compile`: Build via `cmmn compile` (TypeScript → `dist/esm`, then esbuild bundle to `dist/index.cjs`).
- `yarn run`: Start dev server with `node --watch` against `configs/.env`.
- `yarn test`: Node's native test runner over compiled `dist/esm/**/*.spec.js` — run `yarn compile` first.
- `yarn gcp-build`: Generate the Prisma client (invoked during deploy).
- `yarn import`: Run `scripts/import-texts.js` against `scripts/.env`.
- `yarn ngrok`: Expose `localhost:5800` for webhook testing.
- `docker compose up postgres`: Local Postgres on `:5432` (compose also defines a MySQL service).

Run a single test by pointing `--test` at the compiled file, e.g. `node --test dist/esm/scheduler/specs/scheduler.spec.js`.

## Coding Style & Naming Conventions

- TypeScript strict mode via `@cmmn/tools/tsconfig.json`; ESM only (`"type": "module"`).
- SWC compiles with stage-3 decorators (`decoratorVersion: "2022-03"`); `@cmmn/core` provides DI (`@singleton()`).
- Filenames are camelCase (`prismaSchedulerStorage.ts`) or kebab-case for compounds (`text-to-speech.ts`); spec files end in `.spec.ts`.

## Testing Guidelines

- Framework: Node `node:test` with `expect` for assertions.
- Specs sit next to implementation (`src/db/prismaSchedulerStorage.spec.ts`) or under `src/specs/` and `src/scheduler/specs/`. Tests run on compiled output, so a green `yarn compile` is a prerequisite.

## Commit & Pull Request Guidelines

- Concise, imperative subjects (`add word command`, `fix imports`, `quiz migration`); `upd` is the project shorthand for "update".
- Always `git add` newly created files before committing — untracked files are silently excluded.
- `.github/workflows/deploy.yml` deploys merges to `main` to the `telegram` Cloud Function (production); other branches deploy to `telegram-stage`.
