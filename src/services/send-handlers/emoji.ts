import type {TaskSendHandler} from "./index";

export const emoji: TaskSendHandler = async function emojiHandler(task, skipNotification) {
    const emojis = await this.ai.prompt(`
        Generate 3-5 emojis that depict ${task.content}. 
        Return only one variant. 
        Don't include additional text, return only emojis.
    `);
    if (!emojis) return;
    return this.tg.telegram.sendMessage(+task.chatId, emojis, {
        disable_notification: skipNotification
    })
}

