import {EventEmitter} from "@cmmn/core";

export abstract class Messenger extends EventEmitter<MessengerEvents>{
    abstract name: string;
    abstract init(): Promise<void>;
    abstract send(to: string | number, message: Message, options: MessageOptions): Promise<void>;
    abstract handle(request: {
        body: any;
        query: any
    }, res): Promise<void>;
}

export type MessengerEvents = {
    message: IncomingMessageEvent;
    command: CommandContext;
    callback: CallbackEvent;
}
export type MessageOptions = {
    disable_notification?: boolean;
    replyTo?: string | number
    preview_url?: boolean;
    reply_markup?: any; // TODO: implement
}
export type BaseContext = IncomingMessageEvent & {
}
export type MessageContext = BaseContext & {
    message: Message;
    textMessage?: TextMessage;
    audioMessage?: AudioMessage;
}
export type CommandContext = BaseContext & {
    message: TextMessage;
}
export type ChatEvent = {
    id: string | number;
    chat: string | number;
    user: {
        id: string | number;
        name: string | undefined;
    }
    reply(message: Message | string, options?: MessageOptions): Promise<void>;
}
export type CallbackEvent = ChatEvent & {
    data: unknown;
}
export type IncomingMessageEvent = ChatEvent & {
    timestamp: number;
    audio(): Promise<AudioMessage | undefined>;
    text(): Promise<TextMessage | undefined>;
}

export type TextMessage = {
    type: 'text';
    text: string;
}

export type ImageMessage = {
    type: 'image';
    image: Buffer;
}

export type AudioMessage = {
    type: 'audio';
    audio: Buffer;
    audioType: 'mp3' | 'ogg';
}

export type QuizMessage = {
    type: 'quiz';
    question: string;
    answers: string[];
    options: any;
}


export type Message =
    | QuizMessage
    | ImageMessage
    | AudioMessage
    | TextMessage
;

