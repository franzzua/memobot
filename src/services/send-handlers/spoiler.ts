import type {TaskSendHandler} from "./index";

export const spoiler: TaskSendHandler = async function spoilerHandler(task) {
    return `<b>${task.content}</b>\n\n<span class="tg-spoiler">${task.details}</span>`;
}