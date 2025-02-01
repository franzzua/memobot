import {Container, di} from "@di";
import {TelegramMessenger} from "../messengers/tg/telegram.messenger";
import process from "node:process";
import {WhatsAppMessenger} from "../messengers/whatsAppMessenger";

export function getMessenger(name: string, container: Container = di){
    switch (name){
        case 'whatsapp':
            return container.resolve(WhatsAppMessenger, process.env.WA_PHONE_NUMBER_ID!, process.env.SYSTEM_USER_TOKEN!);
        case 'telegram':
            return container.resolve(TelegramMessenger, process.env.BOT_TOKEN!);
    }
}