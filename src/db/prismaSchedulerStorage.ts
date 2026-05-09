import type { Prisma, Message as PrismaMessage } from "../../prisma/client";
import { PrismaClient } from "../../prisma/client";
import type { SchedulerStorage, Task, TimetableEntity } from "../scheduler/storage/schedulerStorage";
import type { MessageTimetable } from "./messagesDatabase";
import {resolve, singleton} from "@cmmn/core";
import type { Chat } from "../types";
import { ChatState } from "../types";
import {Logger} from "../logger/logger";

type ChatEntity = Chat & Task & {
    isPaused: boolean;
    state: ChatState;
    stateData: unknown;
}

@singleton()
export class PrismaSchedulerStorage implements SchedulerStorage<MessageTimetable> {
    private prisma = resolve(PrismaClient)

    @Logger.measure
    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        const existing = await this.prisma.chat.findUnique({
            where: {id: chat.id}
        });
        if (existing) return;

        await this.prisma.chat.create({
            data: {
                ...chat,
                isPaused: false,
                state: ChatState.initial
            }
        });
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<{ state: ChatState, stateData: unknown }> {
        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                isPaused: false
            },
            select: {state: true, stateData: true}
        });
        if (!chat) return undefined as unknown as { state: ChatState, stateData: unknown };
        return {
            state: chat.state as ChatState,
            stateData: chat.stateData ? JSON.parse(chat.stateData) : null
        };
    }

    @Logger.measure
    public async updateChat(chat: Partial<ChatEntity>): Promise<void> {
        if (!chat.id) throw new Error("Chat ID required");
        const data: Prisma.ChatUpdateInput = {};
        if (chat.username !== undefined) data.username = chat.username;
        if (chat.userId !== undefined) data.userId = chat.userId;
        if (chat.state !== undefined) data.state = chat.state;
        if (chat.stateData !== undefined) data.stateData = JSON.stringify(chat.stateData);
        if (chat.isPaused !== undefined) data.isPaused = chat.isPaused;
        if (chat.scheduleId !== undefined) data.scheduleId = chat.scheduleId;
        if (chat.scheduledAt !== undefined) data.scheduledAt = chat.scheduledAt;

        await this.prisma.chat.update({
            where: {id: chat.id},
            data
        });
    }

    public updateChatState(chatId: string, state: ChatState, stateData: unknown = null) {
        return this.updateChat({id: chatId, state, stateData});
    }

    @Logger.measure
    async saveInitData(chatId: string, englishLevel: string, preparationMonths: number): Promise<void> {
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { englishLevel, preparationMonths }
        });
    }

    @Logger.measure
    async savePlanState(chatId: string, planStart: Date, planDurationDays: number, wordOrder: string[]): Promise<void> {
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { planStart, planDurationDays, wordOrder }
        });
    }

    @Logger.measure
    async getPlanState(chatId: string): Promise<{ planStart: Date; planDurationDays: number; wordOrder: string[] } | null> {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            select: { planStart: true, planDurationDays: true, wordOrder: true }
        });
        if (!chat?.planStart || chat.planDurationDays == null) return null;
        return {
            planStart: chat.planStart,
            planDurationDays: chat.planDurationDays,
            wordOrder: chat.wordOrder ?? []
        };
    }

    @Logger.measure
    async countMessagesByKind(chatId: string, kind: string): Promise<number> {
        return this.prisma.message.count({
            where: { chatId, kind }
        });
    }

    @Logger.measure
    async deactivateTicks(chatId: string): Promise<void> {
        await this.prisma.message.updateMany({
            where: { chatId, kind: 'tick' },
            data: { next: null }
        });
    }

    public setIsPaused(chatId: string, isPaused: boolean) {
        return this.updateChat({id: chatId, isPaused})
    }

    async saveTask(task: Task): Promise<void> {
        await this.prisma.chat.update({
            where: { id: task.id },
            data: {
                scheduleId: task.scheduleId,
                scheduledAt: task.scheduledAt
            }
        });
    }

    async addTimetable(taskId: string, timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        await this.prisma.message.create({
            data: {
                ...(timetable.id ? { id: timetable.id } : {}),
                chatId: taskId,
                content: timetable.content,
                details: timetable.details,
                createdAt: timetable.createdAt,
                number: timetable.number,
                deleted: timetable.deleted,
                type: timetable.type,
                dates: JSON.stringify(timetable.dates),
                last: timetable.last,
                next: timetable.next,
                invokeCounter: timetable.invokeCounter,
                kind: timetable.kind ?? 'memo',
                refId: timetable.refId ?? null,
            }
        });
    }

    @Logger.measure
    async removeTimetablesByKind(chatId: string, kinds: string[]): Promise<void> {
        await this.prisma.message.deleteMany({
            where: { chatId, kind: { in: kinds } }
        });
    }

    @Logger.measure
    async getSeenQuizIds(chatId: string): Promise<string[]> {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            select: { seenQuizIds: true }
        });
        return chat?.seenQuizIds ?? [];
    }

    @Logger.measure
    async appendSeenQuiz(chatId: string, quizId: string): Promise<void> {
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { seenQuizIds: { push: quizId } }
        });
    }

    @Logger.measure
    async getNextUnseenQuiz(chatId: string) {
        const seen = await this.getSeenQuizIds(chatId);
        const [quiz] = await this.prisma.quiz.findMany({
            where: seen.length > 0 ? { id: { notIn: seen } } : {},
            orderBy: { index: 'asc' },
            take: 1,
        });
        return quiz ?? null;
    }

    async getTimetablesBefore(taskId: string, before: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        const messages = await this.prisma.message.findMany({
            where: {
                chatId: taskId,
                next: {
                    lte: before,
                    not: null
                }
            }
        });
        return messages.map(this.mapToEntity);
    }

    async getNextTimetableTime(taskId: string): Promise<Date | null> {
        const message = await this.prisma.message.findFirst({
            where: {
                chatId: taskId,
                next: { not: null }
            },
            orderBy: {
                next: 'asc'
            },
            select: { next: true }
        });
        return message?.next ?? null;
    }

    async getTask(taskId: string): Promise<Task | undefined> {
        const chat = await this.prisma.chat.findUnique({
            where: { id: taskId }
        });
        if (!chat) return undefined;
        return {
            id: chat.id,
            scheduleId: chat.scheduleId,
            scheduledAt: chat.scheduledAt
        };
    }

    async updateTimetable(taskId: string, id: string, patch: Partial<TimetableEntity<MessageTimetable>>): Promise<void> {
        const { dates, ...rest } = patch;
        const data = { ...rest } as unknown as Prisma.MessageUpdateInput;
        if (dates) {
            data.dates = JSON.stringify(dates);
        }
        await this.prisma.message.update({
            where: { chatId_id: { chatId: taskId, id } },
            data: data,
        });
    }

    @Logger.measure
    async getMaxNumber(chatId: string) {
        return this.prisma.message.count({
            where: {chatId}
        });
    }

    @Logger.measure
    async removeAllMessages(chatId: string) {
        await this.prisma.message.deleteMany({
            where: {chatId}
        });
        await this.prisma.chat.update({
            where: {id: chatId},
            data: {
                planStart: null,
                planDurationDays: null,
                wordOrder: [],
                seenQuizIds: [],
                scheduleId: null,
                scheduledAt: null,
            }
        });
    }

    @Logger.measure
    async getAllMessages(chatId: string, isActive: boolean) {
        const messages = await this.prisma.message.findMany({
            where: {
                chatId,
                next: isActive ? {not: null} : null
            }
        });
        return messages.map(x => this.mapToEntity(x));
    }

    @Logger.measure
    async getMessagesByKind(chatId: string, kinds: string[]) {
        const messages = await this.prisma.message.findMany({
            where: { chatId, kind: { in: kinds } }
        });
        return messages.map(x => this.mapToEntity(x));
    }

    async getRandomQuiz() {
        const count = await this.prisma.quiz.count();
        if (count === 0) return null;
        const skip = Math.floor(Math.random() * count);
        const [quiz] = await this.prisma.quiz.findMany({ take: 1, skip });
        return quiz ?? null;
    }

    async getQuizByIndex(index: number) {
        const [quiz] = await this.prisma.quiz.findMany({ take: 1, skip: index });
        return quiz ?? null;
    }

    @Logger.measure
    async deleteMessage(chatId: string, number: number) {
        await this.prisma.message.updateMany({
            where: {chatId, number},
            data: {deleted: true}
        });
    }

    private mapToEntity(msg: PrismaMessage): TimetableEntity<MessageTimetable> {
        const { dates, kind, refId, ...rest } = msg;
        return {
            ...rest,
            kind: kind as MessageTimetable['kind'],
            refId,
            dates: JSON.parse(dates).map(x => new Date(x)),
        } as unknown as TimetableEntity<MessageTimetable>;
    }
}
