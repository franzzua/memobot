import {singleton} from "@di";
import {Chat, ChatState, Message} from "../types";
import {AggregateField, Filter, Firestore, Timestamp} from "@google-cloud/firestore";
import {Logger} from "../logger/logger";
import {env} from "../env";
import {gcsConfig} from "./gcs.config";
import {SchedulerStorage, Task, TimetableEntity} from "../scheduler/storage/schedulerStorage";
import {DateTimetable} from "../scheduler/types";

@singleton()
export class ChatDatabase implements SchedulerStorage<MessageTimetable> {

    constructor() {
    }

    private firestore = new Firestore({
        databaseId: env.IsProd ? 'memobot' : 'memobot-dev',
        projectId: gcsConfig.projectId
    });
    private chats = this.firestore.collection('chats');

    @Logger.measure
    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        await this.firestore.doc(`chats/${chat.id}`)
            .get()
            .then(x => {
                if (x.exists) return;
                return x.ref.set({
                    ...chat,
                    isPaused: false,
                    idCounter: 0,
                    state: ChatState.initial
                });
            });
    }


    @Logger.measure
    async getIdCounter(chatId: string): Promise<number> {
        return await this.chats.doc(chatId).get().then(x => x.get('idCounter'));
    }

    @Logger.measure
    async updateChatState(chatId: string, state: ChatState, stateData: any = null) {
        await this.chats.doc(chatId).set({state, stateData}, {
            merge: true
        });
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<{ state: ChatState, stateData: any }> {
        return await this.chats.doc(chatId)
            .get().then(x => ({
                state: x.get('state'),
                stateData: x.get('stateData'),
            }));
    }

    @Logger.measure
    async getChatMessenger(chatId: string): Promise<string> {
        return await this.chats.doc(chatId)
            .get().then(x => x.get('messenger'));
    }

    @Logger.measure
    async checkChatActive(chatId: string) {
        const chat = await this.chats.doc(chatId).get();
        if (!chat.exists)
            return false;
        const isPaused = await chat.get('isPaused');
        return !isPaused;
    }

    @Logger.measure
    async setIsPaused(chatId: string, isPaused: boolean) {
        await this.chats.doc(chatId).set({isPaused}, {merge: true});
    }


    private getMessages(chatId: string) {
        return this.chats.doc(chatId).collection('messages');
    }

    @Logger.measure
    async saveTask(task: Task): Promise<void> {
        await this.chats.doc(task.id).set(task, {
            merge: true
        });
    }

    @Logger.measure
    async getTask(taskId: string): Promise<Task | undefined> {
        const result = await this.chats.doc(taskId).get();
        if (result.get('isPaused')) return undefined;
        return fixTimestamps(result?.data()) as Task | undefined;
    }

    @Logger.measure
    async addTimetable(taskId: string, timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        if (timetable.id)
            await this.getMessages(taskId).doc(timetable.id).set(timetable);
        else
            await this.getMessages(taskId).add(timetable);
    }

    @Logger.measure
    async getTimetablesBefore(taskId: string, to: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        const result = await this.getMessages(taskId).where(Filter.and(
            Filter.where('next', '<=', to),
        )).get();
        return result.docs.map(x => fixTimestamps(x.data()) as TimetableEntity<MessageTimetable>);
    }

    @Logger.measure
    async getNextTimetableTime(taskId: string): Promise<Date | null> {
        const result = await this.getMessages(taskId).where(Filter.and(
            Filter.where('next', '!=', null)
        )).orderBy('next', 'asc').limit(1).select('next').get();
        return fixTimestamps(result.docs[0]?.data().next) ?? null;
    }

    @Logger.measure
    async getMaxNumber(chatId: string) {
        const result = await this.getMessages(chatId).aggregate({
            max: AggregateField.count()
        }).get();
        return result.data().max;
    }

    @Logger.measure
    async deleteMessage(chatId: string, number: number) {
        const id = await this.getMessages(chatId).where(Filter.and(
            Filter.where('number', '==', number),
        )).select('id').limit(1).get();
        await this.getMessages(chatId).doc(id.docs[0].id).set({
            deleted: true,
        }, {merge: true})
    }

    @Logger.measure
    async updateTimetable(taskId: string, id: string, patch: Partial<MessageTimetable>): Promise<void> {
        await this.getMessages(taskId).doc(id).set(patch, {merge: true});
    }

    @Logger.measure
    async removeAllMessages(chatId: string) {
        const docs = await this.getMessages(chatId).listDocuments();
        for (let doc of docs) {
            await doc.delete();
        }
    }

    @Logger.measure
    getAllMessages(chatId: string, isActive: boolean) {
        return this.getMessages(chatId).where(Filter.and(
            Filter.where('next', isActive ? '!=' : '==', null)
        )).get().then(x => x.docs.map(x => x.data() as Message));
    }
}

function fixTimestamps(value: unknown) {
    if (!value) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(fixTimestamps);
    const res = {} as any;
    for (let key in value) {
        res[key] = fixTimestamps(value[key]);
    }
    return res;
}

export type MessageTimetable = Message & DateTimetable