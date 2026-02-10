import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {di, singleton} from "@cmmn/core";
import {TaskQueue} from "./taskQueue";
import {PrismaSchedulerStorage} from "./prismaSchedulerStorage";

@singleton()
export class TaskScheduler extends Scheduler<Message> {
    constructor() {
        super(di.resolve(PrismaSchedulerStorage), di.resolve(TaskQueue));
    }
}