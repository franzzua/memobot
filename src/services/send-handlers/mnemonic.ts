import type {TaskSendHandler} from "./index";
import {resolve} from "@di";
import {AiModel} from "../ai-model";

export const mnemonic: TaskSendHandler = async function mnemonicHandler(task, skipNotification) {
    const ai = resolve(AiModel);
    const acrostic = await ai.prompt(`
        Generate Acrostic or creative memory aid using the letters of the word '${task.content}'
        Return only one acrostic or creative memory aid without additional text.
    `);
    if (!acrostic) return;
    return this.send(+task.chatId, acrostic.replace(/\*\*(\w)\*\*/g, m => `<b>${m[2]}</b>`), {
        disable_notification: skipNotification,
    })
}