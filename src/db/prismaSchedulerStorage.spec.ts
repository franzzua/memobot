import {describe, test, beforeEach, afterEach} from "node:test";
import {expect} from "expect";
import {PrismaSchedulerStorage} from "./prismaSchedulerStorage";
import {TimetablePolicyType} from "../scheduler/types";
import {prismaFactory} from "../../prisma/client";

describe("PrismaSchedulerStorage", () => {
    const prisma = prismaFactory();
    const storage = new PrismaSchedulerStorage();

    beforeEach(async () => {
        await prisma.message.deleteMany();
        await prisma.chat.deleteMany();
        // Create a chat for testing
        await prisma.chat.create({
            data: {
                id: 'test-chat',
                username: 'test',
                userId: 'user1',
                state: 0,
                isPaused: false,
            }
        });
    });

    afterEach(async () => {
        await prisma.$disconnect();
    });

    test("saveTask updates scheduling info", async () => {
        const now = new Date();
        await storage.saveTask({
            id: 'test-chat',
            scheduleId: 'sched1',
            scheduledAt: now
        });

        const chat = await prisma.chat.findUnique({where: {id: 'test-chat'}});
        expect(chat?.scheduleId).toBe('sched1');
        expect(chat?.scheduledAt).toEqual(now);
    });

    test("addTimetable creates message", async () => {
        const now = new Date();
        await storage.addTimetable('test-chat', {
            id: 'msg1',
            content: 'hello',
            details: 'details',
            createdAt: now,
            number: 1,
            deleted: false,
            type: TimetablePolicyType.Dates,
            dates: [now],
            last: now,
            next: now,
            invokeCounter: 0
        } as any);

        const msg = await prisma.message.findUnique({where: {chatId_id: {chatId: 'test-chat', id: 'msg1'}}});
        expect(msg).toBeDefined();
        expect(JSON.parse(msg!.dates)).toHaveLength(1);
    });

    test("getTimetablesBefore returns relevant messages", async () => {
        const now = new Date();
        const future = new Date(now.getTime() + 10000);
        
        await storage.addTimetable('test-chat', {
            id: 'msg1',
            content: 'hello',
            details: 'details',
            createdAt: now,
            number: 1,
            deleted: false,
            type: TimetablePolicyType.Dates,
            dates: [],
            last: now,
            next: now, // Should be picked
            invokeCounter: 0
        } as any);

        await storage.addTimetable('test-chat', {
            id: 'msg2',
            content: 'hello2',
            details: 'details',
            createdAt: now,
            number: 2,
            deleted: false,
            type: TimetablePolicyType.Dates,
            dates: [],
            last: now,
            next: future, // Should NOT be picked
            invokeCounter: 0
        } as any);

        const results = await storage.getTimetablesBefore('test-chat', new Date(now.getTime() + 1000));
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('msg1');
    });
});
