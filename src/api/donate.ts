import { CommandContext } from "./types";
import { Context } from "telegraf";

export async function onDonate(ctx: CommandContext){
    return ctx.reply('Choose payment method', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'USD' , callback_data: 'USD' },
                    { text: 'EUR' , callback_data: 'EUR' },
                    { text: 'PayPal' , callback_data: 'PayPal' },
                    { text: 'RUB' , callback_data: 'RUB' },
                ], [
                    { text: 'USDT' , callback_data: 'USDT' },
                    { text: 'BTC' , callback_data: 'BTC' },
                    { text: 'ETH' , callback_data: 'ETH' },
                    { text: 'TON' , callback_data: 'TON' },
                ]
            ]
        }
    })
}

export async function onCallback(ctx: Context){
    // @ts-ignore
    const data = ctx.update.callback_query.data;
    await ctx.reply(payments[data], {
        parse_mode: 'HTML'
    })
}
export const payments: Record<PaymentType, string> = {
    USD: `Pay with <a href="https://donate.stripe.com/14k2c4abp1Fhf2o8wy">stripe</a>`,
    EUR: `Pay with <a href="https://revolut.me/newtimesroman">Revolut</a>`,
    PayPal: `Pay with <a href="http://paypal.me/spixdonations">PayPal</a>`,
    RUB: `Pay with <a href="https://www.tinkoff.ru/cf/8j0Q6m9aAQC">Tinkoff</a>`,
    USDT: `USDT: <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    BTC: `BTC: <code>1PnaC2R3XC7yuogz6vJe4NbPGcK9Jy8P2X</code>`,
    ETH: `ETH: <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    TON: `TON: <code>UQBwCIZdi8uuWm-gwS_8pTnaMWFYIrkiUpodeWlVsDJbPHPJ</code>`,
}

export type PaymentType =
    "USD" | "EUR" | "PayPal" | "RUB" | "USDT" | "BTC" | "ETH" | "TON";