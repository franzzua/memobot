import {TelegrafApi} from "../telegraf.api";
import {CommandContext} from "../types";
import {ImageRender} from "../../services/image-render";

export async function image(this: TelegrafApi, ctx: CommandContext) {
    const imageRender = new ImageRender('Hello', 'My dear friend!');
    const stream = imageRender.render();
    return ctx.replyWithPhoto({
        source: stream
    });
}