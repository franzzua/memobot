import type {TaskSendHandler} from "./index";

export const spoiler: TaskSendHandler = function spoilerHandler(task, skipNotification) {
    return this.send(+task.chatId, `<b>${task.content}</b>`, {
        disable_notification: skipNotification,
        spoiler: task.details
    });
}