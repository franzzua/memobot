import {singleton} from "@di";
import {Message} from "../types";
import {Filter, Firestore, AggregateField} from "@google-cloud/firestore";
import {env} from "../env";
import {gcsConfig} from "./gcs.config";
import {SchedulerStorage, Task, TimetableEntity} from "../scheduler/storage/schedulerStorage";
import {DateTimetable} from "src/scheduler/types";

@singleton()
export class TaskDatabase implements SchedulerStorage<MessageTimetable> {

    private firestore = new Firestore({
        databaseId: env.IsProd ? 'memobot' : 'memobot-dev',
        projectId: gcsConfig.projectId
    });

    private tasks = this.firestore.collection('tasks');

    private getMessages(chatId: string){
        return this.tasks.doc(chatId).collection('messages');
    }
    
    async saveTask(task: Task): Promise<void> {
        await this.tasks.doc(task.id).set(task);
    }

    async getTask(taskId: string): Promise<Task | undefined> {
        const result = await this.tasks.doc(taskId).get();
        return result?.data() as Task | undefined;
    }
    async deleteTask(taskId: string): Promise<void> {
        await this.tasks.doc(taskId).delete();
    }

    async addTimetable(taskId: string, timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        if (timetable.id)
            await this.getMessages(taskId).doc(timetable.id).set(timetable);
        else
            await this.getMessages(taskId).add(timetable);
    }

    async getTimetables(taskId: string, from: Date, to: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        const result = await this.getMessages(taskId).where(Filter.and(
            Filter.where('next', '>', from),
            Filter.where('next', '<=', to),
        )).get();
        return result.docs.map(x => x.data() as TimetableEntity<MessageTimetable>);
    }

    async getNextTimetableTime(taskId: string, from: Date): Promise<Date | null> {
        const result = await this.getMessages(taskId)
            .where(Filter.where('next', '>', from))
            .orderBy('next', 'asc').limit(1).select('next').get();
        return result.docs[0]?.data().next as Date ?? null;
    }

    async getMaxNumber(chatId: string) {
        const result = await this.tasks.doc(chatId).collection('messages').aggregate({
            max: AggregateField.count()
        }).get();
        return result.data().max;
    }

    async deleteMessage(chatId: string, number: number) {
        const id = await this.getMessages(chatId).where({
            number
        }).select('id').limit(1).get();
        await this.getMessages(chatId).doc(id.docs[0].id).set({
            deleted: true
        }, {merge: true})
    }

    async updateTimetable(taskId: string, id: string, patch: Partial<MessageTimetable>): Promise<void> {
        await this.getMessages(taskId).doc(id).set(patch, {merge: true});
    }

}

export type MessageTimetable = Message & DateTimetable