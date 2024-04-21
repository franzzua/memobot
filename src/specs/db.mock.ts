import { Chat, Message, Task, TaskState } from "../types";
import {orderBy} from "@cmmn/core";

export class MockDb {

    private tasks = [] as Task[];

    async addChat(chat: Chat): Promise<void> {
        return Promise.resolve(undefined);
    }

    async addMessage(message: Message): Promise<void> {
        this.tasks.push(...message.tasks.map((task: Task) => ({
            ...task,
            message: message
        })));
    }

    async clear(): Promise<void> {
        return Promise.resolve(undefined);
    }

    getMissedTasks(){
        return this.tasks.filter(x => +x.date < +new Date() && x.state == TaskState.new);
    }

    getNextTask() {
        return orderBy(this.tasks.filter(x => x.state == TaskState.new), x => +x.date)[0];
    }

    async updateTaskState(task: Pick<Task, "id" | "state">): Promise<void> {
        const existed = this.tasks.find(x => x.id == task.id)
        if (!existed) return;
        existed.state = task.state;
    }

}