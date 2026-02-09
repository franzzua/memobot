import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import { onQuizWriteAnswer } from "./quiz";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getAllText, getRandomText, getText} from "../../helpers/getRandomText";

export async function onAnyMessage(this: TelegrafApi, e: IncomingMessageEvent) {
    const message = await e.text();
    if (!message) return;
    const { state, stateData } = await this.chatDatabase.getChatState(e.chat.toString());
    switch (state) {
        case ChatState.writeQuiz:
            return onQuizWriteAnswer.call(this, e, stateData);
        case ChatState.deleteMessage:
            const id = +message.text;
            if (!Number.isFinite(id))
                return e.reply(getText('/number', 0));
            const isSuccess = await this.bot.deleteMessage(e.chat.toString(), id);
            if (!isSuccess){
                return e.reply([getText('/number', 1, id), getText('/number', 2)].join('\n'));
            }
            await this.chatDatabase.updateChatState(e.chat.toString(), ChatState.initial);
            return e.reply(getAllText('/last', id));
        case ChatState.addNew: {
            const content = message.text;
            await this.chatDatabase.updateChatState(e.chat.toString(), ChatState.setDetails, { content });
            const count = await this.chatDatabase.getMaxNumber(e.chat.toString());
            const reply = getRandomText('/new-details', e.user.id, count);
            return e.reply(reply);
        }
        case ChatState.setDetails: {
            const number = await this.bot.addMessage(stateData.content, message.text, e.chat.toString(), e.user.id.toString());
            await this.chatDatabase.updateChatState(e.chat.toString(), ChatState.initial);
            const reply = getRandomText('/new-success', e.user.id, number, number.toString());
            return e.reply(reply);
        }

    }
}
