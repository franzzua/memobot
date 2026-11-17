import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {openGameButton} from "../../duel/wiring";

const intro = `<b>Word Duel</b> 🧩
Take letters from a shared board, one per turn, and build words of 5+ letters out of tiles that touch. Take a tile your opponent needs to block them.
Study words from your list are hidden on the board and score double.`;

// /duel opens the game list, where you can play the bot or challenge a friend.
export async function duel(this: TelegrafApi, ctx: IncomingMessageEvent) {
    return ctx.reply(intro, {reply_markup: openGameButton()});
}

// /start duel_<id> comes from a friend's invite link.
export async function duelInvite(this: TelegrafApi, ctx: IncomingMessageEvent, id: string) {
    return ctx.reply(`You've been challenged to <b>Word Duel</b> 🧩\nOpen the game to join and see the board.`, {
        reply_markup: openGameButton(id, 'Join the game'),
    });
}
