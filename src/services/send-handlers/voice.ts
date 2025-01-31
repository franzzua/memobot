import type {TaskSendHandler} from "./index";

export const voice: TaskSendHandler = async function voiceHandler(task, skipNotification) {
    const stream = await this.textToSpeech.getStream(task.content, 'mp3');
    return this.tg.telegram.sendVoice(task.chatId, {
        source: stream,
    }, {
        disable_notification: skipNotification
    });
}


