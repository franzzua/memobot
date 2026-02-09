import {IncomingMessageEvent} from "../../messengers/messenger";
import {TelegrafApi} from "../telegraf.api";
import {getRandomText} from "../../helpers/getRandomText";

export async function actions(this: TelegrafApi, ctx: IncomingMessageEvent) {
    return ctx.reply(getRandomText('/actions', ctx.user.id, +new Date()), {
        reply_markup: {
            keyboard: [
                [
                    {text: '/stop'},
                    {text: '/resume'}
                ],
                [
                    {text: '/delete'},
                    {text: '/list'}
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}