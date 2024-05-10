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

export type Task = Pick<Message, "content" | "details" > & {
    messageId: number;
    chatId: string;
    index: number;
    start: number;
}

export const enum ChatState {
    initial= 0,
    deleteMessage = 2,
    addNew = 3,
    setDetails = 4,
}