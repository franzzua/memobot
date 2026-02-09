import type {TaskSendHandler} from "./index";
import {ImageRender} from "../image-render";
import {AudioMessage, ImageMessage} from "../../messengers/messenger";

export const image: TaskSendHandler = async function imageHandler(task) {
    const image = new ImageRender(task.content, task.details);
    const stream = image.render();
    return {
        type: 'image',
        image: stream,
    } as ImageMessage;
}