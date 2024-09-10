import { singleton } from "@di";
import { Chat, ChatState, Message, Task } from "../types";
import { Filter, Firestore } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";
import { now, Timetable, TimetableDelay } from "../bot/timetable";
import { env } from "../env";

@singleton()
export class ChatDatabase {

    constructor() {
    }
    private store = new Firestore({
        databaseId: env.IsProd ? 'memobot' : 'memobot-dev',
    });
    private chats = this.store.collection('chats');
    private messages(chatId: string){
        return this.chats.doc(chatId).collection('messages');
    }
    private tasks(chatId: string){
        return this.chats.doc(chatId).collection('tasks');
    }
    @Logger.measure
    async addMessage(chatId: string, message: Omit<Message, "id" | "createdAt">): Promise<number> {
        const id = (await this.getIdCounter(chatId) + 1);
        await this.messages(chatId).doc(id.toString()).set({
            ...message,
            createdAt: new Date(),
            progress: 0
        });
        await this.chats.doc(chatId).set({
            idCounter: id
        }, {merge: true});
        return id;
    }

    @Logger.measure
    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        await this.store.doc(`chats/${chat.id}`)
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
        await this.chats.doc(chatId).set({ state, stateData }, {
                merge: true
            });
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<{state: ChatState, stateData: any }>{
        return await this.chats.doc(chatId)
            .get().then(x => ({
                state: x.get('state'),
                stateData: x.get('stateData'),
            }));
    }

    @Logger.measure
    async checkChatActive(chatId: string){
        const chat = await this.chats.doc(chatId).get();
        if (!chat.exists)
            return false;
        const isPaused = await chat.get('isPaused');
        return !isPaused;
    }

    @Logger.measure
    async removeChat(chatId: string) {
        const messages = await this.messages(chatId).listDocuments()
        for (let message of messages) {
            await message.delete();
        }
        await this.chats.doc(chatId).delete();
    }

    @Logger.measure
    async deleteLastActiveMessage(chatId: string) {
        const message = await this.getMessages(chatId, true);
        if (message.length == 0)
            return null;
        const id = Math.max(...message.map(x => x.id));
        await this.messages(chatId).doc(id.toString()).delete();
        return id;
    }

    @Logger.measure
    async increaseProgress(chatId: string, messageId: number) {
        const messages = this.messages(chatId);
        const msg = await messages.doc(messageId.toString()).get();
        if (!msg.exists) return;
        await msg.ref.set({
            progress: msg.data()!.progress + 1
        }, {merge: true});
    }


    @Logger.measure
    async getMessages(chatId: string, active: boolean) {
        const messages = await this.messages(chatId)
            .where(Filter.where('progress', active ? '<' : '==', Timetable.length))
            .get();
        return messages.docs.map(x => ({...x.data(), id: + x.id} as Message));
    }

    @Logger.measure
    async deleteMessage(chatId: string, id: number) {
        const doc = await this.messages(chatId).doc(id.toString()).get();
        if (!doc.exists)
            return false;
        await doc.ref.delete();
        return true;
    }

    @Logger.measure
    async setIsPaused(chatId: string, isPaused: boolean) {
        await this.chats.doc(chatId).set({isPaused}, {merge: true});
    }


    @Logger.measure
    async addTask(task: Task): Promise<void> {
        await this.tasks(task.chatId).add({
            ...task,
            state: 'initial'
        }).then(x => x.id);
    }

    @Logger.measure
    async useTasks(chatId: string, action: (tasks: Task[]) => Promise<void>): Promise<boolean> {
        return await this.store.runTransaction(async t => {
            try {
                const taskDocs = await t.get(
                    this.tasks(chatId).where(Filter.and(
                        Filter.where('state', '==', 'initial'),
                        Filter.where('time', '<=', now() + TimetableDelay / 2),
                    ))
                ).then(x => x.docs);
                for (let taskDoc of taskDocs) {
                    t.update(taskDoc.ref, {
                        state: 'pending'
                    });
                }
                await action(taskDocs.map(x => x.data() as Task));
                for (let taskDoc of taskDocs) {
                    t.delete(taskDoc.ref);
                }
                await this.setQueueInfo(chatId, null);
            }catch (e){
                console.error(e);
                throw e;
            }
        }).then(() => true).catch(() => false);
    }
    
    async getQueueInfo(chatId: string): Promise<QueueTaskInfo | null> {
        return this.chats.doc(chatId).get().then(x => x.get('nextTaskTime'));
    }

    async getNextTaskTime(chatId: string){
        return this.tasks(chatId)
            .where(Filter.where('state', '==', 'initial'))
            .orderBy('time', 'asc').limit(1).get()
            .then(x => x.docs[0]?.get('time'));
    }

    async setQueueInfo(chatId: string, time: QueueTaskInfo | null) {
        await this.chats.doc(chatId).set({
            nextTaskTime: time ?? 0
        }, {merge: true})
        
    }

    async getMessage(chatId: string, messageId: number): Promise<Message> {
        return this.messages(chatId).doc(messageId.toString()).get().then(x => x.data() as Message);
    }

    async deleteAllMessage(chatId: string) {
        const messages = await this.messages(chatId).get();
        for (let doc of messages.docs) {
            await doc.ref.delete();
        }
        const tasks = await this.messages(chatId).get();
        for (let doc of tasks.docs) {
            await doc.ref.delete();
        }
    }
}

export type QueueTaskInfo = {
    isMoved: boolean;
    time: number;
    name: string;
}