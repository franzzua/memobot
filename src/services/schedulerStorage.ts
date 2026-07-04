import type {Word} from "../../prisma/client";

export type ProjectedWord = {
    word: string;
    description: string;
    dates: Date[];
    scheduled: boolean;
};

export type ProjectedQuiz = {
    date: Date;
    scheduled: boolean;
};

/**
 * The scheduler "role": returns the next message time (word or quiz) and advances the plan.
 * Implemented by {@link SrsPlanner}. Depends only on the {@link DataStore} port, so it is
 * fully unit-testable against `TestJsonStorage` with no database.
 */
export abstract class SchedulerStorage {
    /** Time of the next message the user will receive (min over word/quiz/tick rows). */
    abstract getNextMessageTime(chatId: string): Promise<Date | null>;

    /** Introduce the next due word, fire any due quizzes, and re-arm the next tick. */
    abstract advance(chatId: string): Promise<{ scheduledWord: Word | null; scheduledQuiz: boolean }>;

    /** Build a fresh SRS plan for the chat and schedule its first events. */
    abstract planForChat(chatId: string, level: string, months: number): Promise<{
        wordCount: number;
        quizCount: number;
        words: ProjectedWord[];
        quizzes: ProjectedQuiz[];
    }>;

    /** Project the full plan (scheduled + future) without mutating anything. */
    abstract projectPlan(chatId: string): Promise<{ words: ProjectedWord[]; quizzes: ProjectedQuiz[] }>;
}
