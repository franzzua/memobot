export abstract class SchedulerBackend<TaskId = string, ScheduleId = string> {
    abstract scheduleTask(id: TaskId, date: Date): Promise<ScheduleId>;
    abstract unschedule(id: ScheduleId): Promise<void>;
}