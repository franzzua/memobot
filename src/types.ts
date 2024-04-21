import type { Chat as PChat, Message as PMessage, Task as PTask} from "@prisma/client";

export type Chat = Omit<PChat, "state"> & {
    state: ChatState;
} ;

export type Message = PMessage & {
    tasks: Array<Task>;
    chat: Chat
}

export type Task = Omit<PTask, "state"> & {
    state: TaskState;
}

export const enum TaskState {
    new = 1,
    pending = 2,
    succeed = 3,
    failed = 4
}
export const enum ChatState {
    initial = 0,
    paused = 1,
}