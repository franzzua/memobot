import {baseFunction} from "./base";
import {di} from "@di";
import {Messenger} from "../messengers/messenger";
import {WhatsAppMessenger} from "../messengers/whatsAppMessenger";
import process from "node:process";
import {TelegrafApi} from "../api/telegraf.api";
import {getMessenger} from "./getMessenger";

const context = di.child();
context.factory(Messenger, c => getMessenger('whatsapp', c));

export const whatsapp = baseFunction('whatsapp', async (req, res) => {
    if (req.method == "get"){
        console.log(req.query);
        const mode = req.query["hub.mode"];
        // @ts-ignore
        const token = req.query["hub.verify_token"];
        // @ts-ignore
        const challenge = req.query["hub.challenge"];
        console.log(mode, token, challenge);

        // check the mode and token sent are correct
        if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFICATION_TOKEN) {
            // respond with 200 OK and challenge token from the request
            console.log("Webhook verified successfully!");
            return challenge;
        } else {
            // respond with '403 Forbidden' if verify tokens do not match
            res.status(403);
        }
        return;
    }
    const tg = context.resolve(TelegrafApi);
    await tg.init();
    await tg.messenger.handle(req, res);
});