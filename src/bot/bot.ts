import { ChatState, Message, Task, TaskState } from "../types";
import { v4 as uuid } from "uuid";
import { NextTaskData, TaskDatabase } from "../db/taskDatabase";
import { inject, singleton } from "@di";

@singleton()
export class MemoBot {
    @inject(TaskDatabase)
    private db!: TaskDatabase;

    public min = 100;
    public hour = () => 60 * this.min;
    public day = () => 24*this.hour();
    public week = () => 7*this.day();
    public month = () => 4*this.week();
    public repeatDurations = [
        42*this.min,
        24*this.hour(),
        42*this.hour(),
        this.week(),
        2*this.week(),
        this.month(),
        2*this.month()
    ];

    constructor() {
        this.runNextTask();
    }

    private isDisposed = false;
    private timer: NodeJS.Timeout | undefined;
    private nextTask: NextTaskData | null = null;
    public onTask = new EventTarget();
    public async runMissed(){
        const tasks = await this.db.getMissedTasks();
        this.onTask.dispatchEvent(new TasksEvent(tasks));
    }
    public async runNextTask(){
        if (this.timer) clearTimeout(this.timer);
        this.nextTask = await this.db.getNextTask();
        if (!this.nextTask) {
            console.log(`No task left, going to sleep...`);
            return;
        }
        if (this.isDisposed) return;
        console.log(`next task in ${+this.nextTask.date - +new Date()}ms`);
        this.timer = setTimeout(async () => {
            if (!this.nextTask){
                this.runNextTask();
                return;
            }
            this.onTask.dispatchEvent(new TasksEvent([this.nextTask]));
            await this.db.updateTaskState({
                id: this.nextTask.id,
                state: TaskState.pending
            });
            this.runNextTask();
        }, +this.nextTask.date - +new Date())
    }


    public async addMessage(content: string, details: string, chatId: string): Promise<number> {
        const id = uuid();
        const tasks: Task[] = this.repeatDurations.map((x, index) => ({
            messageId: id,
            date: new Date(+new Date() + x),
            state: TaskState.new,
            index,
            id: uuid()
        }));
        const message = {
            content,
            details,
            chatId,
            createdAt: new Date(),
            id
        }
        const number = await this.db.addMessage(message, tasks);
        this.runNextTask();
        return number;
    }

    async [Symbol.asyncDispose]() {
        this.timer && clearTimeout(this.timer);
        this.isDisposed = true;
        console.log('dispose');
    }

    async stop(chatId: string) {
        await this.db.updateChatState({id: chatId, state: ChatState.paused});
        if (!this.nextTask)
            return;
        if (this.nextTask.message.chatId == chatId) {
            this.nextTask = null;
            this.timer && clearTimeout(this.timer);
            this.runNextTask();
        }
    }

    async resume(chatId: string) {
        await this.db.updateChatState({id: chatId, state: ChatState.initial});
        this.timer && clearTimeout(this.timer);
        this.runNextTask();
    }

    async onTaskEnd(id: string, state: TaskState) {
        await this.db.updateTaskState({ id, state });
    }
}


export class TasksEvent extends Event{
    public static type = 'tasks';
    constructor(public tasks: Array<NextTaskData>) {
        super(TasksEvent.type);
    }
}