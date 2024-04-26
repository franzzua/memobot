import { singleton } from "@di";
import { Chat, ChatState, Message } from "../types";
import { Filter, Firestore, AggregateQuery, AggregateField } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";

@singleton()
export class TaskDatabase {

    private store = new Firestore({
        databaseId: 'memobot',
    });
    private chats = this.store.collection('chats');
    private getMessages(chatId: string){
        return this.chats.doc(chatId).collection('messages');
    }
    @Logger.measure
    async addMessage(chatId: string, message: Omit<Message, "id" | "createdAt">): Promise<number> {
        const id = await this.getMessages(chatId)
            .count().get().then(x => x.data().count + 1);
        await this.getMessages(chatId).doc(id.toString()).set({
            ...message,
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
        return this.getMessages(chatId)
            .count().get().then(x => x.data().count);
    }

    @Logger.measure
    async updateChatState(chat: Pick<Chat, "id" | "state">) {
        await this.store.doc(`chats/${chat.id}`)
            .set({ state: chat.state});
    }

    @Logger.measure
    async getChatState(chatId: string): Promise<ChatState>{
        return await this.chats.doc(chatId)
            .get().then(x => x.get('state'))
            .then(x => x as ChatState);

    }

    @Logger.measure
    async removeChat(chatId: string) {
        const messages = await this.getMessages(chatId).listDocuments()
        for (let message of messages) {
            await message.delete();
        }
        await this.chats.doc(chatId).delete();
    }
}
