import {MemoDoc} from "./database";

export class TaskStore {
    constructor() {
    }
    private googleDoc = new MemoDoc();

    public Messages = this.googleDoc.getTasks()

    public async getNextTasks(){
        const result: { date: Date | null, tasks: {task: Task, message: Message}[] }= {
            date: null,
            tasks: []
        };
        for (let message of await this.Messages) {
            for (let task of message.tasks) {
                if (task.state !== 'new') continue;
                if (result.date == null || result.date > task.date) {
                    result.date = task.date;
                    result.tasks = [{task, message}];
                } else if (result.date == task.date) {
                    result.tasks.push({task, message});
                }
            }
        }
        return result;
    }

    public async addMessage(message: Message){
        const tasks = await this.Messages;
        const sheet = await this.googleDoc.getSheet(message);
        await sheet.addMessage(message);
        tasks.push(message);
    }


    async setTaskState(message: Message, task: Task, state: Task['state']) {
        const tasks = await this.Messages;
        const sheet = await this.googleDoc.getSheet(message);
        if (!message.id) throw new Error(`Task without id`);
        await sheet.setTaskState(message.id, message.tasks.indexOf(task), state);
        task.state = 'failed';
    }
}
export type Message = {
    id?: number;
    chatId: number;
    userName: string;
    message: string;
    createdAt: Date;
    tasks: Array<Task>;
}

export type Task = {
    date: Date;
    state: 'new'|'pending'|'succeed'|'failed';
}