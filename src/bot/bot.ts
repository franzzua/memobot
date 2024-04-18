import { Message, Task, TaskState } from "../types";
import { v4 as uuid } from "uuid";
import { TaskDatabase } from "../db/taskDatabase";
const min = 100;
const hour = 60 * min;
const day = 24*hour;
const week = 7*day;
const month = 4*week;
const repeatDurations = [
    42*min,
    24*hour,
    42*hour,
    week,
    2*week,
    month,
    2*month
];

export class MemoBot {
    constructor(private db: TaskDatabase) {
        this.subscribeOnNext();
    }
    private timer: NodeJS.Timeout | undefined;
    public onTask = new EventTarget();
    public async subscribeOnNext(){
        if (this.timer) clearTimeout(this.timer);
        const tasks = await this.db.getNextTasks();
        for (let task of tasks) {
            const date = task.date;
            console.log(`next task in ${+date - +new Date()}ms`)
            this.timer = setTimeout(() => {
                this.onTask.dispatchEvent(new TasksEvent(task));
                this.subscribeOnNext();
            }, +date - +new Date())
        }
    }

    public async addMessage(message: string, chatId: number, name: string){
        console.log(`new message '${message}'`);
        const id = uuid();
        await this.db.addMessage({
            content: message,
            details: message,
            chatId,
            createdAt: new Date(),
            id,
            chat: {
                id: chatId,
                username: name,
                userId: name
            },
            tasks: repeatDurations.map(x => ({
                messageId: id,
                date: new Date(+new Date() + x),
                state: TaskState.new,
                id: uuid()
            }))
        });
        await this.subscribeOnNext();
    }
}


export class TasksEvent extends Event{
    public static type = 'tasks';
    constructor(public task: Pick<Task, "date" | "id"> & {
        message: Pick<Message, "chatId"|"content"|"details">
    }) {
        super(TasksEvent.type);
    }
}