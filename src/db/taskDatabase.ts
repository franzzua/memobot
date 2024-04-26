import { singleton } from "@di";
import { Chat, ChatState, Message } from "../types";
import { Filter, Firestore, AggregateQuery, AggregateField } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";

@singleton()
export class TaskDatabase {

    private store = new Firestore({
        databaseId: 'memobot',
    });
    private messages = this.store.collection('messages');
    private chats = this.store.collection('chats');

    @Logger.measure
    async addMessage(message: Omit<Message, "id" | "createdAt">): Promise<number> {
        const id = await this.messages
            .where(Filter.where('chatId', '==', message.chatId))
            .count().get().then(x => x.data().count + 1);
        await this.messages.add({
            ...message,
            id,
            createdAt: new Date()
        });
        return id;
    }

    @Logger.measure
    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        await this.store.doc(`chats/${chat.id}`)
            .set({...chat, state: ChatState.initial })
            .catch(x => {
                console.log('Not exists, creating...')
                const chats = this.store.collection('chats');
                return chats.add(chat);
            });
    }


    @Logger.measure
    async getMessageCount(chatId: string): Promise<number> {
        return this.store.collection('messages')
            .where(Filter.where('chatId', '==', chatId))
            .count().get().then(x => x.data().count);
    }

    @Logger.measure
    async updateChatState(chat: Pick<Chat, "id" | "state">) {
        await this.store.doc(`chats/${chat.id}`)
            .set({ state: chat.state});
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<ChatState>{
        return await this.store.doc(`chats/${chatId}`)
            .get().then(x => x.get('state'))
            .then(x => x as ChatState);

    }

    async removeChatAndMessages(chatId: string) {
        await this.chats.doc(chatId).delete();
        const messages = await this.messages.where(Filter.where('chatId', '==', chatId)).get();
        for (let msg of messages.docs) {
            await msg.ref.delete();
        }
    }
}
