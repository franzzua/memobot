import {Timetable} from "../types";

export abstract class SchedulerStorage<
    TTimetable extends Timetable = Timetable,
    TaskId = string,
    QueueId = string
> {
    abstract saveTask(task: Task<TaskId, QueueId>): Promise<void>;
    abstract addTimetable(taskId: TaskId, timetable: TimetableEntity<TTimetable>): Promise<void>;
    abstract getTimetablesBefore(taskId: TaskId, before: Date): Promise<TimetableEntity<TTimetable>[]>;
    abstract getNextTimetableTime(taskId: TaskId): Promise<Date | null>;
    abstract getTask(taskId: TaskId): Promise<Task<TaskId, QueueId> | undefined>;
    abstract updateTimetable(taskId: TaskId, id: TTimetable["id"], patch: Partial<TimetableEntity<TTimetable>>): Promise<void>;
}

export type Task<TaskId = string, ScheduleId = string> = {
    id: TaskId;
    scheduleId: ScheduleId | null;
    scheduledAt: Date | null;
};
export type TimetableEntity<TTimetable extends Timetable = Timetable> = TTimetable & {
    last: Date;
    next: Date | null;
    invokeCounter: number;
}