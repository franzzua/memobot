import {Container, di} from "@cmmn/core";
import {TelegramMessenger} from "../messengers/tg/telegram.messenger";
import process from "node:process";

export function getMessenger(name: string, container: Container = di){
    switch (name){
        case 'telegram':
            return container.resolve(TelegramMessenger, process.env.BOT_TOKEN!);
    }
}