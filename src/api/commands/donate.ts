import { CommandContext } from "../types";
import { Context } from "telegraf";

export async function donate(ctx: CommandContext){
    return ctx.reply('💳 Please select your payment method', {
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
    USD: `💵 Pay with <a href="https://donate.stripe.com/14k2c4abp1Fhf2o8wy">Stripe</a>`,
    EUR: `💶 Pay with <a href="https://revolut.me/newtimesroman">Revolut</a>`,
    PayPal: `🌐 Pay with <a href="https://paypal.me/spixenglish">PayPal</a>`,
    RUB: `🏦 Pay with <a href="https://pay.cloudtips.ru/p/aa517638">Tinkoff</a>`,
    USDT: `🔗 Pay with USDT: <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    BTC: `🔗 Pay with Bitcoin (BTC): <code>1PnaC2R3XC7yuogz6vJe4NbPGcK9Jy8P2X</code>`,
    ETH: `🔗 Pay with Ethereum (ETH): <code>0x5d00b2104332feef90cfe4b7eb8be5f7b224ff7a</code>`,
    TON: `🔗 Pay with TON: <code>UQBwCIZdi8uuWm-gwS_8pTnaMWFYIrkiUpodeWlVsDJbPHPJ</code>`,
}

export type PaymentType =
    "USD" | "EUR" | "PayPal" | "RUB" | "USDT" | "BTC" | "ETH" | "TON";
