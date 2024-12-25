import type {TaskSendHandler} from "./index";

export const ai: TaskSendHandler = async function aiHandler(task, skipNotification) {
    const text = await this.ai.prompt(`
        Generate short phrase containing ${task.content}.
        Return only this phrase without additional text       
    `);
    if (!text) return;
    return this.tg.telegram.sendMessage(+task.chatId, text, {
        disable_notification: skipNotification
    })
}


