# Repository Guidelines

Memobot is a Telegram and WhatsApp bot built on Google Cloud Platform, designed for information retention using a Spaced Repetition System (SRS) and AI integrations (Gemini 2.0 Flash).

## Project Structure & Module Organization

- **src/scheduler/**: Core SRS engine. Decouples timing logic from execution.
- **src/bot/**: Bot logic and timetable definitions for SRS.
- **src/db/**: Database abstractions for Firestore and Prisma (SQL).
- **src/messengers/**: Platform-specific implementations for Telegram (`telegraf`) and WhatsApp.
- **src/services/**: Core business services including AI-driven mnemonic generation, image rendering, and Text-to-Speech.
- **src/functions/**: GCP Cloud Function entry points for webhooks and task execution.
- **src/api/**: Fastify-based webhook handlers and API commands.

## Build, Test, and Development Commands

- **yarn run**: Start the development server with watch mode: `node --watch --env-file=configs/.env --import @cmmn/tools/import ./src/start.ts`
- **yarn compile**: Build the project using the `cmmn` toolset.
- **yarn test**: Run the test suite on compiled files: `DOTENV_CONFIG_PATH=./configs/.env node -r dotenv/config --test dist/esm/**/*.spec.js`
- **yarn gcp-build**: Generate the Prisma client.
- **yarn import**: Run word import scripts.
- **yarn ngrok**: Expose the local server for webhook testing.

## Coding Style & Naming Conventions

- **TypeScript**: Strict mode is enforced via `@cmmn/tools/tsconfig.json`.
- **ESM**: The project uses native ES modules (`type: "module"`).
- **Dependency Injection**: Core logic utilizes `@cmmn/core` for DI and service management.
- **Prisma**: Used for relational database operations.
- **GCP Native**: Extensive use of Google Cloud SDKs (Firestore, Tasks, Vertex AI).

## Testing Guidelines

- **Framework**: Uses Node.js native test runner.
- **Execution**: Tests run against the `./dist/esm` build. Ensure `yarn compile` is run before `yarn test`.
- **Specs**: Test files are named `*.spec.ts` and located alongside implementation or in `src/specs/`.

## Commit & Pull Request Guidelines

- **Style**: Use concise, imperative messages (e.g., `fix imports`, `add word command`).
- **Convention**: `upd` is commonly used for "update".
- **New files**: Always `git add` every newly created file before committing. Untracked files are silently excluded from commits.
