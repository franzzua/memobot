import {TimetableStore, TimetableEntity} from "./schedulerStorage";
import type {MessageTimetable} from "../../db/messagesDatabase";
import type {Word} from "../../../prisma/client";

/**
 * Raw persistence port for the SRS scheduler. Extends the generic {@link TimetableStore}
 * (task + timetable rows the generic `Scheduler` needs) with the plan/message/word reads
 * the `SrsPlanner` needs to decide the next word/quiz.
 *
 * Two implementations: `PrismaStorage` (real Postgres) and `TestJsonStorage` (in-memory,
 * seedable — used to unit-test the scheduler under different conditions without a DB).
 *
 * Non-scheduling app methods (chat state, delete/getMaxNumber, random quiz, …) are
 * deliberately NOT part of this port; they live only on the concrete `PrismaStorage`.
 */
export abstract class DataStore extends TimetableStore<MessageTimetable> {
    // plan state
    abstract getPlanState(chatId: string): Promise<{ planStart: Date; planDurationDays: number; wordOrder: string[] } | null>;
    abstract savePlanState(chatId: string, planStart: Date, planDurationDays: number, wordOrder: string[]): Promise<void>;

    // message bookkeeping
    abstract countMessagesByKind(chatId: string, kind: string): Promise<number>;
    abstract deactivateTicks(chatId: string): Promise<void>;
    abstract removeTimetablesByKind(chatId: string, kinds: string[]): Promise<void>;
    abstract getMessagesByKind(chatId: string, kinds: string[]): Promise<TimetableEntity<MessageTimetable>[]>;

    // word reads used by planning
    abstract pickTopForLevel(level: string, n: number): Promise<Word[]>;
    abstract getByIds(ids: string[]): Promise<Map<string, Word>>;
}
