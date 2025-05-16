import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {di, singleton} from "@di";
import {TaskDatabase} from "./taskDatabase";
import {TaskQueue} from "./taskQueue";

@singleton()
export class TaskScheduler extends Scheduler<Message> {
    constructor() {
        super(di.resolve(TaskDatabase), di.resolve(TaskQueue));
    }
}