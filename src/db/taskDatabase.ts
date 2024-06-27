import { singleton } from "@di";
import { Chat, ChatState, Message, Task, TaskState } from "../types";
import { Filter, Firestore, AggregateQuery, AggregateField } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";
import { Timetable } from "../bot/timetable";
import { env } from "../env";

@singleton()
export class TaskDatabase {

    private store = new Firestore({
        databaseId: env.IsProd ? 'memobot' : 'memobot_dev',
    });
    private tasks = this.store.collection('tasks');
    
    async clear(){
        const docs = await this.tasks.listDocuments();
        for (let doc of docs) {
            await doc.delete();
        }
    }
    
    
}
