export type Chat = {
    id: string
    username: string
    userId: string
    state: ChatState;
} ;

export type Message = {
    id: number
    chatId: string
    content: string
    details: string
    createdAt: Date
}

export type Task = Pick<Message, "content" | "details" | "id" | "chatId"> & {
    name: string;
}

export const enum ChatState {
    initial = 0,
    paused = 1,
}