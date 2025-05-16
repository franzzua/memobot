import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {di, singleton} from "@di";
import {TaskQueue} from "./taskQueue";
import {ChatDatabase} from "./chatDatabase";

@singleton()
export class TaskScheduler extends Scheduler<Message> {
    constructor() {
        super(di.resolve(ChatDatabase), di.resolve(TaskQueue));
    }
}