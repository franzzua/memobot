import type {TaskSendHandler} from "./index";
import {resolve} from "@di";
import {AiModel} from "../ai-model";

export const emoji: TaskSendHandler = async function emojiHandler(task) {
    const ai = resolve(AiModel);
    return await ai.prompt(`
        Generate 3-5 emojis that depict ${task.content}. 
        Return only one variant. 
        Don't include additional text, return only emojis.
    `);
}

