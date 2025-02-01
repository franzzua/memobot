import type {TaskSendHandler} from "./index";

export const youglish: TaskSendHandler = async function youglishHandler(task, skipNotification) {
    const href = `https://youglish.com/pronounce/${encodeURIComponent(task.content)}/english`;
    return this.send(task.chatId, `Youglish video: ${href}`, {
        disable_notification: skipNotification,
        preview_url: true,
    })
}