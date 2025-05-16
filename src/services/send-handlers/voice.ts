import type {TaskSendHandler} from "./index";
import {resolve} from "@di";
import {TextToSpeech} from "../text-to-speech";
import {AudioMessage} from "../../messengers/messenger";

export const voice: TaskSendHandler = async function voiceHandler(task) {
    const textToSpeech = resolve(TextToSpeech);
    const stream = await textToSpeech.getStream(task.content, 'ogg_opus');
    return {
        type: 'audio',
        audio: stream,
        audioType: 'ogg'
    } as AudioMessage;
}


