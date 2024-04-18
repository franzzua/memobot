export type Chat = {
    id: number;
    username: string;
    userId: string;
}

export type Message = {
    id: string;
    chatId: number;
    content: string;
    details: string;
    createdAt: Date;
    tasks: Array<Task>;
    chat: Chat
}

export type Task = {
    id: string;
    date: Date;
    state: TaskState;
    messageId: string;
}

export const enum TaskState {
    new = 1,
    pending = 2,
    succeed = 3,
    failed = 4
}