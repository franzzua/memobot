import {TelegramMessenger} from "./telegram.messenger";
import {Message, MessageOptions} from "../messenger";
import { User } from "telegraf/types";

export class TelegramChatEvent {
    public chat = this.chatId;
    public user = {
        id: this.tgUser?.id!,
        name: [this.tgUser?.last_name, this.tgUser?.first_name].filter(x => x).join(' ')
    }
    constructor(private chatId: string | number,
                private tgUser: User | undefined,
                protected messenger: TelegramMessenger) {
    }

    public reply(message: Message | string, options: MessageOptions) {
        return this.messenger.send(this.chatId, message, options);
    }
}