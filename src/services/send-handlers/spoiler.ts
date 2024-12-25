import type {TaskSendHandler} from "./index";

export const spoiler: TaskSendHandler = function spoilerHandler(task, skipNotification) {
    const message = `<strong>${task.content}</strong>\n\n` +
        `<span class="tg-spoiler">${task.details}</span>`;
    return this.tg.telegram.sendMessage(+task.chatId, message, {
        parse_mode: 'HTML',
        disable_notification: skipNotification
    });
}