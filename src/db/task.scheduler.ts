import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {di, singleton} from "@di";
import {TaskQueue} from "./taskQueue";
import {ChatsDatabase} from "./chatsDatabase";

@singleton()
export class TaskScheduler extends Scheduler<Message> {
    constructor() {
        super(di.resolve(ChatsDatabase), di.resolve(TaskQueue));
    }
}