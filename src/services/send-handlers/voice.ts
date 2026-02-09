import type {TaskSendHandler} from "./index";
import {resolve} from "@cmmn/core";
import {TextToSpeech} from "../text-to-speech";

export const voice: TaskSendHandler = async function voiceHandler(task, skipNotification) {
    const textToSpeech = resolve(TextToSpeech);
    const stream = await textToSpeech.getStream(task.content, 'ogg_opus');
    return this.send(task.chatId, {
        type: 'audio',
        audio: stream,
        audioType: 'ogg'
    }, {
        disable_notification: skipNotification
    });
}


