import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import { onQuizWriteAnswer } from "./quiz";
import {IncomingMessageEvent} from "../../messengers/messenger";


const replyDetails = [
    "📝 Add item details: the definition, explanation, rule, example, translation, link, etc.",
    "📝 Add item details: the definition, explanation, rule, example, translation, etc.",
    "📝 Add item details: the definition, explanation, rule, example, etc.",
    "📝 Add item details: the definition, explanation, rule, etc.",
    "📝 Add item details: the definition, explanation, etc.",
    "📝 Add item details: the definition, etc.",
    "📝 Add item details",
    "📝 Add details",
];

export async function onAnyMessage(this: TelegrafApi, e: IncomingMessageEvent) {
    const message = await e.text();
    if (!message) return;
    const { state, stateData } = await this.db.getChatState(e.chat.toString());
    switch (state) {
        case ChatState.writeQuiz:
            return onQuizWriteAnswer.call(this, e, stateData);
        case ChatState.deleteMessage:
            const id = +message.text;
            if (!Number.isFinite(id))
                return e.reply(`#️⃣ Type in the number of the entry`);
            const isSuccess = await this.db.deleteMessage(e.chat.toString(), id);
            if (!isSuccess){
                return e.reply(`⚠️ Entry #${id} not found. Type in the number of an existing entry \n\n`+
                    `💡 _Find the item in your list with_ */current* _or_ */complete*`,{
                });
            }
            await this.db.updateChatState(e.chat.toString(), ChatState.initial);
            return e.reply(`❌ Entry #${id} deleted`);
        case ChatState.addNew: {
            const content = message.text;
            await this.db.updateChatState(e.chat.toString(), ChatState.setDetails, { content });
            const count = await this.db.getIdCounter(e.chat.toString());
            const reply = replyDetails[count] ?? replyDetails.at(-1);
            return e.reply(reply);
        }
        case ChatState.setDetails: {
            const number = await this.bot.addMessage(stateData.content, message.text, e.chat.toString(), e.user.id.toString());
            await this.db.updateChatState(e.chat.toString(), ChatState.initial);
            return e.reply(`✅ Entry #${number} added`);
        }

    }
}
