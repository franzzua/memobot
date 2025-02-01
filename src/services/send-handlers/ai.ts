import type {TaskSendHandler} from "./index";
import {resolve} from "@di";
import {AiModel} from "../ai-model";

export const ai: TaskSendHandler = async function aiHandler(task, skipNotification) {
    const ai = resolve(AiModel);
    const text = await ai.prompt(`
        Generate short phrase containing ${task.content}.
        Return only this phrase without additional text       
    `);
    if (!text) return;
    return this.send(+task.chatId, text, {
        disable_notification: skipNotification
    })
}


