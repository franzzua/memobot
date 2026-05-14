import {AudioMessage, CallbackEvent, IncomingMessageEvent, ReplyToInfo, TextMessage} from "../messenger";
import type * as tg from "@telegraf/types";
import {TelegramMessenger} from "./telegram.messenger";
import {TelegramChatEvent} from "./telegramChatEvent";
import {CallbackQuery} from "@telegraf/types/markup";

export class TelegramMessageEvent extends TelegramChatEvent implements IncomingMessageEvent {
    public timestamp = this.message.date;
    public id = this.message.message_id;
    public replyTo?: ReplyToInfo;

    constructor(private message: tg.Message, messenger: TelegramMessenger) {
        super(message.chat.id, message.from, messenger)
        const replyTo = (message as tg.Message & { reply_to_message?: tg.Message }).reply_to_message;
        if (replyTo) {
            const text = (replyTo as tg.Message.TextMessage).text
                ?? (replyTo as tg.Message.CaptionableMessage).caption;
            if (text) {
                this.replyTo = {
                    text,
                    isBot: replyTo.from?.is_bot === true,
                };
            }
        }
    }

    async audio(): Promise<AudioMessage | undefined> {
        const {audio} = this.message as tg.Message.AudioMessage;
        if (!audio) return undefined;
        const fileUrl = await this.messenger.tg.telegram.getFileLink(audio.file_id);
        const arrayBuffer = await fetch(fileUrl).then(x => x.arrayBuffer());
        return {
            type: 'audio',
            audioType: audio.mime_type?.split('/').pop() as any,
            audio: Buffer.from(arrayBuffer)
        } as AudioMessage;
    }

    async text(): Promise<TextMessage | undefined> {
        const {text, entities} = this.message as tg.Message.TextMessage;
        if (text || entities) {
            return {
                type: 'text',
                text: text
            } as TextMessage;
        }
    }

}

export class TelegramCallbackEvent extends TelegramChatEvent implements CallbackEvent {
    public id = this.callback.id;

    constructor(private callback: CallbackQuery, messenger: TelegramMessenger) {
        super((callback as any).message?.chat?.id ?? callback.chat_instance, callback.from, messenger);
    }

    get data(){
        if ('data' in this.callback)
            return this.callback.data;
        return undefined;
    }

}