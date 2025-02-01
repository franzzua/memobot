import type {TaskSendHandler} from "./index";

export const spoiler: TaskSendHandler = function spoilerHandler(task, skipNotification) {
    return this.send(+task.chatId, {
        type: 'text',
        text: `*${task.content}*`
    }, {
        disable_notification: skipNotification,
        spoiler: task.details
    });
}