import {Callback} from "./index";
import {CallbackEvent, ChatEvent, IncomingMessageEvent} from "../../messengers/messenger";

export async function donate(ctx: IncomingMessageEvent) {
    return ctx.reply('💳 Please select your payment method', {
        reply_markup: {
            inline_keyboard: [
                [
                    {text: 'USD', callback_data: 'USD'},
                    {text: 'EUR', callback_data: 'EUR'},
                    {text: 'PayPal', callback_data: 'PayPal'},
                    {text: 'RUB', callback_data: 'RUB'},
                ], [
                    {text: 'USDT', callback_data: 'USDT'},
                    {text: 'BTC', callback_data: 'BTC'},
                    {text: 'ETH', callback_data: 'ETH'},
                    {text: 'TON', callback_data: 'TON'},
                ]
            ]
        }
    })
}

const payments: Record<PaymentType, string> = {
    USD: `💵 Pay with <a href="https://donate.stripe.com/14k2c4abp1Fhf2o8wy">Stripe</a>`,
    EUR: `💶 Pay with <a href="https://revolut.me/newtimesroman">Revolut</a>`,
    PayPal: `🌐 Pay with <a href="https://paypal.me/spixenglish">PayPal</a>`,
    RUB: `🏦 Pay with <a href="https://pay.cloudtips.ru/p/aa517638">Tinkoff</a>`,
    USDT: '🔗 Pay with USDT: ```0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a```',
    BTC: '🔗 Pay with Bitcoin (BTC): ```1PnaC2R3XC7yuogz6vJe4NbPGcK9Jy8P2X```',
    ETH: '🔗 Pay with Ethereum (ETH): ```0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a```',
    TON: '🔗 Pay with TON: ```UQBwCIZdi8uuWm-gwS_8pTnaMWFYIrkiUpodeWlVsDJbPHPJ```',
}

function getCallback(text: string): Callback {
    return function (ctx: ChatEvent) {
        return ctx.reply(text)
    };
}

export const paymentCallbacks = Object.fromEntries(
    Object.entries(payments).map(([key, text]) => [key, getCallback(text)])
);

export type PaymentType =
    "USD" | "EUR" | "PayPal" | "RUB" | "USDT" | "BTC" | "ETH" | "TON";
