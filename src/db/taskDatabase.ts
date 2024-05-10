import { singleton } from "@di";
import { Chat, ChatState, Message } from "../types";
import { Filter, Firestore, AggregateQuery, AggregateField } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";
import { Timetable } from "../bot/timetable";

@singleton()
export class TaskDatabase {

    private store = new Firestore({
        databaseId: 'memobot',
    });
    private chats = this.store.collection('chats');
    private messageCollection(chatId: string){
        return this.chats.doc(chatId).collection('messages');
    }
    @Logger.measure
    async addMessage(chatId: string, message: Omit<Message, "id" | "createdAt">): Promise<number> {
        const id = (await this.getIdCounter(chatId) + 1);
        await this.messageCollection(chatId).doc(id.toString()).set({
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
    async checkMessageActive(chatId: string, messageId: number){
        const chat = await this.chats.doc(chatId).get();
        if (!chat.exists)
            return false;
        const isPaused = await chat.get('isPaused');
        if (isPaused) return false;
        const msg = await this.messageCollection(chatId).doc(messageId.toString()).get();
        return msg.exists;
    }

    @Logger.measure
    async removeChat(chatId: string) {
        const messages = await this.messageCollection(chatId).listDocuments()
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
        await this.messageCollection(chatId).doc(id.toString()).delete();
        return id;
    }

    @Logger.measure
    async increaseProgress(chatId: string, messageId: number) {
        const messages = this.messageCollection(chatId);
        const msg = await messages.doc(messageId.toString()).get();
        if (!msg.exists) return;
        await msg.ref.set({
            progress: msg.data()!.progress + 1
        }, {merge: true});
    }


    @Logger.measure
    async getMessages(chatId: string, active: boolean) {
        const messages = await this.messageCollection(chatId)
            .where(Filter.where('progress', active ? '<' : '==', Timetable.length))
            .get();
        return messages.docs.map(x => ({...x.data(), id: + x.id} as Message));
    }

    @Logger.measure
    async deleteMessage(chatId: string, id: number) {
        const doc = await this.messageCollection(chatId).doc(id.toString()).get();
        if (!doc.exists)
            return false;
        await doc.ref.delete();
        return true;
    }

    @Logger.measure
    async setIsPaused(chatId: string, isPaused: boolean) {
        await this.chats.doc(chatId).set({isPaused}, {merge: true});
    }
}
