import {Task, TaskStore} from "./task.store";

const min = 100;
const hour = 60 * min;
const day = 24*hour;
const week = 7*day;
const month = 4*week;
const repeatDurations = [
    42*min,
    24*hour,
    42*hour,
    week,
    2*week,
    month,
    2*month
];

export class MemoBot {
    constructor(private store: TaskStore) {
        this.subscribeOnNext();
    }
    private timer: NodeJS.Timeout | undefined;
    public onTask = new EventTarget();
    public async subscribeOnNext(){
        if (this.timer) clearTimeout(this.timer);
        const {date, tasks} = await this.store.getNextTasks();
        console.log(`no next task`)
        if (!date) return;
        console.log(`next task in ${+date - +new Date()}ms`)
        this.timer = setTimeout(() => {
            this.onTask.dispatchEvent(new TasksEvent(tasks, date));
            this.subscribeOnNext();
        }, +date - +new Date())
    }

    public async addMessage(message: string, chatId: number, name: string){
        console.log(`new message '${message}'`);
        await this.store.addTask({
            message,
            chatId,
            userName: name,
            createdAt: new Date(),
            timetable: repeatDurations.map(x => new Date(+new Date() + x))
        });
        await this.subscribeOnNext();
    }
}


export class TasksEvent extends Event{
    public static type = 'tasks';
    constructor(public tasks: Task[], public date: Date) {
        super(TasksEvent.type);
    }
}