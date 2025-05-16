import type {TaskSendHandler} from "./index";

export const youglish: TaskSendHandler = async function youglishHandler(task) {
    const href = `https://youglish.com/pronounce/${encodeURIComponent(task.content)}/english`;
    return `Youglish video: ${href}`;
}