import {singleton} from "@di";
import {Chat, ChatState, Message} from "../types";
import {Firestore} from "@google-cloud/firestore";
import {Logger} from "../logger/logger";
import {env} from "../env";
import {gcsConfig} from "./gcs.config";
import {SchedulerStorage, Task, TimetableEntity} from "../scheduler/storage/schedulerStorage";
import {MessagesDatabase, MessageTimetable} from "./messagesDatabase";
import {fixTimestamps} from "./fixTimestamps";

@singleton()
export class ChatsDatabase implements SchedulerStorage<MessageTimetable> {

    constructor() {
    }


    private firestore = new Firestore({
        databaseId: env.IsProd ? 'memobot' : 'memobot-dev',
        projectId: gcsConfig.projectId
    });
    private chats = this.firestore.collection('chats');

    @Logger.measure
    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        await this.chats.doc(chat.id).get()
            .then(x => {
                if (x.exists) return;
                return x.ref.set({
                    ...chat,
                    isPaused: false,
                    state: ChatState.initial
                });
            });
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<{ state: ChatState, stateData: any }> {
        return this.queryChat(chatId, ['state', 'stateData']);
    }

    @Logger.measure
    public updateChat(chat: Partial<ChatEntity>): Promise<void> {
        return this.chats.doc(chat.id!).set(chat, {
            merge: true
        }) as Promise<any>;
    }
    public updateChatState(chatId: string, state: ChatState, stateData: any = null) {
        return this.updateChat({id: chatId, state, stateData});
    }

    public setIsPaused(chatId: string, isPaused: boolean) {
        return this.saveTask({id: chatId, isPaused})
    }

    public saveTask(chat: Partial<ChatEntity>): Promise<void> {
        return this.updateChat(chat);
    }

    @Logger.measure
    public getTask(chatId: string): Promise<Task | undefined> {
        return this.queryChat(chatId, ['scheduleId', 'scheduledAt', 'id']);
    }

    private queryChat<Keys extends keyof ChatEntity>(chatId, fields: Array<Keys>): Promise<Pick<ChatEntity, Keys>> {
        return this.chats
            .where('isPaused', '==', false)
            .where('id', '==', chatId)
            .limit(1)
            .select(...fields).get()
            .then(x => x.docs[0]?.data() as any)
            .then(fixTimestamps);
    }

    //region Messages
    private getMessagesDB(chatId: string) {
        return new MessagesDatabase(this.chats.doc(chatId).collection('messages'));
    }

    addTimetable(taskId: string, timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        return this.getMessagesDB(taskId).addTimetable(timetable)
    }

    getTimetablesBefore(taskId: string, before: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        return this.getMessagesDB(taskId).getTimetablesBefore(before)
    }

    getNextTimetableTime(taskId: string): Promise<Date | null> {
        return this.getMessagesDB(taskId).getNextTimetableTime()
    }

    updateTimetable(taskId: string, id: string, patch: Partial<TimetableEntity<MessageTimetable>>): Promise<void> {
        return this.getMessagesDB(taskId).updateTimetable(id, patch)
    }

    async getMaxNumber(chatId: string) {
        return this.getMessagesDB(chatId).getMaxNumber();
    }

    async removeAllMessages(chatId: string) {
        return this.getMessagesDB(chatId).removeAllMessages();
    }

    async getAllMessages(chatId: string, isActive: boolean) {
        return this.getMessagesDB(chatId).queryMessages(isActive);
    }

    async deleteMessage(chatId: string, number: number) {
        return this.getMessagesDB(chatId).deleteMessage(number);
    }

    //endregion
}


export type ChatEntity = Chat & Task & {
    isPaused: boolean;
    state: ChatState;
    stateData: any;
}