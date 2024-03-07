import {MemoDoc} from "./database";

export class TaskStore {
    constructor() {
    }
    private googleDoc = new MemoDoc();

    public Tasks = this.googleDoc.getTasks()

    public async getNextTasks(){
        const result: { date: Date | null, tasks: Task[] }= {
            date: null,
            tasks: []
        };
        for (let task of await this.Tasks) {
            for (let date of task.timetable) {
                if (date < new Date()) continue;
                if (result.date == null || result.date > date){
                    result.date = date;
                    result.tasks = [task];
                } else if (result.date == date){
                    result.tasks.push(task);
                }
            }
        }
        return result;
    }

    public async addTask(task: Task){
        const tasks = await this.Tasks;
        const sheet = await this.googleDoc.getSheet(task);
        await sheet.addTask(task);
        tasks.push(task);
    }

    async onSuccess(task: Task, date: Date) {
        const tasks = await this.Tasks;
        const sheet = await this.googleDoc.getSheet(task);
        if (!task.id) throw new Error(`Task without id`);
        await sheet.setTaskSuccess(task.id, task.timetable.indexOf(date));
    }

    async onFailure(task: Task, date: Date) {
        const tasks = await this.Tasks;
        const sheet = await this.googleDoc.getSheet(task);
        if (!task.id) throw new Error(`Task without id`);
        await sheet.setTaskFailure(task.id, task.timetable.indexOf(date));
    }
}
export type Task = {
    id?: number;
    chatId: number;
    userName: string;
    message: string;
    createdAt: Date;
    timetable: Date[];
}