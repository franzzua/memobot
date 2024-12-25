import type {TaskSendHandler} from "./index";
import {ImageRender} from "../image-render";

export const image: TaskSendHandler = function imageHandler(task, skipNotification) {
    const image = new ImageRender(task.content, task.details);
    const stream = image.render();
    return this.tg.telegram.sendPhoto(+task.chatId, {
        source: stream,
    }, {
        disable_notification: skipNotification
    })
}