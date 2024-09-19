import { TelegrafApi } from "./telegraf.api";
import { CommandContext } from "./types";
import { ImageRender } from "../helpers/image-render";

export async function onWipe(this: TelegrafApi, ctx: CommandContext) {
    await this.bot.deleteAllMessages(ctx.chat.id.toString())
    return ctx.reply(`#️⃣ All data is wiped.`);
}


export async function onImage(this: TelegrafApi, ctx: CommandContext) {
    const imageRender = new ImageRender('Hello', 'My dear friend!');
    imageRender.render();
    return ctx.replyWithPhoto({
        source: imageRender.canvas.createPNGStream()
    });
}