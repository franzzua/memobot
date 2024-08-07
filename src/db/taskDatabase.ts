import { singleton } from "@di";
import { Chat, ChatState, Message, Task, TaskState } from "../types";
import { Filter, Firestore, AggregateQuery, AggregateField } from "@google-cloud/firestore";
import { Logger } from "../logger/logger";
import { Timetable } from "../bot/timetable";

@singleton()
export class TaskDatabase {

    private store = new Firestore({
        databaseId: 'memobot',
    });
    private tasks = this.store.collection('tasks');
    
    async clear(){
        const docs = await this.tasks.listDocuments();
        for (let doc of docs) {
            await doc.delete();
        }
    }
    
    
}
