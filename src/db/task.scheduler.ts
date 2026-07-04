import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {di, singleton} from "@cmmn/core";
import {TaskQueue} from "./taskQueue";
import {PrismaStorage} from "./prismaStorage";

@singleton()
export class TaskScheduler extends Scheduler<Message> {
    constructor() {
        super(di.resolve(PrismaStorage), di.resolve(TaskQueue));
    }
}