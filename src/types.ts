import type { Chat as PChat, Message as PMessage } from "@prisma/client";

export type Chat = Omit<PChat, "state"> & {
    state: ChatState;
} ;

export type Message = PMessage & {
    tasks: Array<Task>;
    chat: Chat
}

export type Task = Pick<Message, "content" | "details" | "number" | "chatId"> & {
    name: string;
}

export const enum ChatState {
    initial = 0,
    paused = 1,
}