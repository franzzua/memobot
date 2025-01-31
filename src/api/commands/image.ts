import {TelegrafApi} from "../telegraf.api";
import {ImageRender} from "../../services/image-render";
import {IncomingMessageEvent} from "../../messengers/messenger";

export async function image(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const imageRender = new ImageRender('Hello', 'My dear friend!');
    const stream = imageRender.render();
    return ctx.reply({
        type: 'image',
        image: stream
    });
}