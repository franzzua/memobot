import type {TaskSendHandler} from "./index";

export const mnemonic: TaskSendHandler = async function mnemonicHandler(task, skipNotification) {
    const acrostic = await this.ai.prompt(`
        Generate Acrostic or creative memory aid using the letters of the word '${task.content}'
        Return only one acrostic or creative memory aid without additional text.
    `);
    if (!acrostic) return;
    return this.tg.telegram.sendMessage(+task.chatId, acrostic, {
        disable_notification: skipNotification,
        parse_mode: 'Markdown'
    })
}