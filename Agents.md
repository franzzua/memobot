# Project Description

Memobot is a Telegram and WhatsApp bot designed to help users memorize information using Spaced Repetition System (SRS). Users can send "memos" to the bot, which are then scheduled to be resent to the user at scientifically calculated intervals (e.g., immediately, 42 minutes, 1 day, 1 week, etc.) to optimize long-term retention.

Key features include:
- **Spaced Repetition:** Automated scheduling of messages based on a predefined timetable (different for Dev/Prod environments).
- **AI Integrations:** Utilizes Google Vertex AI (Gemini 2.0 Flash) to provide intelligent features such as generating mnemonics (acrostics) and emojis for memos.
- **Multi-Messenger Support:** Works with Telegram (via Telegraf) and WhatsApp.
- **Cloud Native:** Built on Google Cloud Platform, utilizing Cloud Functions, Firestore, and Cloud Tasks for scalable serverless operation.
- **Media Support:** Capabilities for text-to-speech and image manipulation.

# Used Libraries

## Core & Framework
- **TypeScript:** Primary language.
- **Node.js:** Runtime environment.
- **@cmmn/core:** Custom dependency injection and core utilities.
- **Fastify:** High-performance web framework (used as the server/webhook handler).

## Cloud & Infrastructure (Google Cloud Platform)
- **@google-cloud/firestore:** NoSQL database for storing chats and messages.
- **@google-cloud/tasks:** Asynchronous task execution for scheduling notifications.
- **@google-cloud/functions-framework:** Framework for writing Google Cloud Functions.
- **@google-cloud/vertexai:** Interface for Gemini 2.0 Flash generative AI model.
- **@google-cloud/text-to-speech:** TTS capabilities.
- **@google-cloud/logging-bunyan:** Structured logging for GCP.

## Messengers / Bots
- **telegraf:** Telegram bot framework.
- **whatsapp:** WhatsApp integration.
- **telegram:** MTProto Telegram client.

## Utilities
- **canvas:** Image generation and manipulation.
- **google-spreadsheet:** Integration with Google Sheets.
- **bunyan:** JSON logging library.
- **uuid:** Unique identifier generation.
- **dotenv:** Environment variable management.

# Scheduler System

The project implements a custom, robust scheduling engine located in `src/scheduler` to handle the complex timing requirements of Spaced Repetition.

## Architecture
- **Core (`Scheduler`):** A generic scheduler class responsible for calculating next execution times and managing task states. It decouples the "when" (logic) from the "how" (execution).
- **Storage Abstraction (`SchedulerStorage`):** Defines a contract for persisting task data and schedule states. This allows the scheduler to be database-agnostic, though the project primarily uses Firestore.
- **Backend/Queue (`SchedulerBackend`):** A pluggable interface for the actual task execution mechanism.
  - **Google Cloud Tasks:** The project includes `GoogleTaskScheduler`, an implementation using Google Cloud Tasks. This provides a highly reliable, serverless infrastructure for triggering events at precise times, even days or weeks in the future.

## Key Features
- **Multi-Timetable Support:** A single task (chat/user) can have multiple independent schedules (timetables) attached to it.
- **Catch-up Logic:** The system can calculate and process missed events (`getTaskState`), ensuring that if the service is temporarily down, the user still receives their due notifications upon recovery.
- **Date-based Policies:** Currently supports explicit date lists (`TimetablePolicyType.Dates`) for defining spaced repetition intervals.
