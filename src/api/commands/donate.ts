import {Callback} from "./index";
import {CallbackEvent, ChatEvent, IncomingMessageEvent} from "../../messengers/messenger";
import {getText} from "../../helpers/getRandomText";

export async function donate(ctx: IncomingMessageEvent) {
    return ctx.reply(getText('/donate', 0), {
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
                ], [
                    {text: '⭐ Telegram Stars', callback_data: 'Stars'},
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
    USDT: `🔗 Pay with USDT: <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    BTC: `🔗 Pay with Bitcoin (BTC): <code>1PnaC2R3XC7yuogz6vJe4NbPGcK9Jy8P2X</code>`,
    ETH: `🔗 Pay with Ethereum (ETH): <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    TON: `🔗 Pay with TON: <code>UQBwCIZdi8uuWm-gwS_8pTnaMWFYIrkiUpodeWlVsDJbPHPJ</code>`,
}

function getCallback(text: string): Callback {
    return function (ctx: ChatEvent) {
        return ctx.reply(text)
    };
}

export const paymentCallbacks = Object.fromEntries(
    Object.entries(payments).map(([key, text]) => [key, getCallback(text)])
);

const starAmounts = [50, 100, 250, 500];

function chooseStars(ctx: ChatEvent) {
    return ctx.reply(`⭐ Choose amount of Stars:`, {
        reply_markup: {
            inline_keyboard: [
                starAmounts.map(stars => ({text: `${stars} ⭐`, callback_data: `stars:${stars}`})),
            ]
        }
    });
}

function getStarsCallback(stars: number): Callback {
    return function (ctx: ChatEvent) {
        return ctx.reply({
            type: 'invoice',
            title: `Support Memobot`,
            description: `Donate ${stars} ⭐ to support the bot development`,
            payload: `donate:${stars}`,
            stars,
        });
    };
}

export const starsCallbacks: Record<string, Callback> = {
    Stars: chooseStars,
    ...Object.fromEntries(starAmounts.map(stars => [`stars:${stars}`, getStarsCallback(stars)])),
};

export type PaymentType =
    "USD" | "EUR" | "PayPal" | "RUB" | "USDT" | "BTC" | "ETH" | "TON";
