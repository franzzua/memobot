export type Chat = {
    id: string
    username: string
    userId: string
    state: ChatState;
} ;

export type Message = {
    id: number
    content: string
    details: string
    createdAt: Date
}

export type Task = Pick<Message, "content" | "details" | "id" > & {
    chatId: string;
    index: number;
    start: number;
}

export const enum ChatState {
    initial = 0,
    paused = 1,
}