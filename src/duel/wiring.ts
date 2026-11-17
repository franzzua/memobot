import {readFile} from "node:fs/promises";
import process from "node:process";
import {resolve} from "@cmmn/core";
import {PrismaClient} from "../../prisma/client";
import {env} from "../env";
import {HIDDEN_COUNT, Lexicon, StudyWord} from "./engine";
import {PrismaDuelStore} from "./store";
import type {DuelDeps, Notifier} from "./api";

// Production dependencies for the Word Duel API: Postgres, the dictionary and page from
// ./assets (copied next to the bundle on deploy), and the bot for "your move" messages.

let lexicon: Promise<Lexicon> | undefined;
let study: { at: number; words: Promise<StudyWord[]> } | undefined;
let page: Promise<string> | undefined;

function shuffled<T>(a: T[]): T[] {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const duelUrl = (id?: string) => `${process.env.PUBLIC_URL}/app${id ? `?game=${encodeURIComponent(id)}` : ''}`;

export function openGameButton(id?: string, text = 'Open Word Duel') {
    return {inline_keyboard: [[{text, web_app: {url: duelUrl(id)}}]]};
}

export function duelDeps(notifier: Notifier): DuelDeps {
    const prisma = resolve(PrismaClient);
    return {
        store: new PrismaDuelStore(prisma),
        botToken: process.env.BOT_TOKEN!,
        notifier,
        lexicon: () => lexicon ??= readFile('./assets/duel-words.txt', 'utf8').then(t => new Lexicon(t.split('\n'))),
        // Hide words from the creator's own study plan; top up from the whole word list
        // when the plan is missing or too short to fill a board.
        studyWords: async (userId: string) => {
            if (!study || Date.now() - study.at > 3600_000) {
                study = {
                    at: Date.now(),
                    words: prisma.word.findMany({select: {id: true, word: true, description: true}, where: {description: {not: null}}})
                        .then((rows: { id: string; word: string; description: string | null }[]) => rows
                            .map(r => ({id: r.id, word: r.word.trim().toUpperCase(), desc: r.description!}))
                            .filter(r => /^[A-Z]{5,9}$/.test(r.word))),
                };
            }
            const all = await study.words as (StudyWord & { id: string })[];
            const chat = await prisma.chat.findFirst({where: {userId}, select: {wordOrder: true}, orderBy: {updatedAt: 'desc'}});
            const planned = new Set<string>(chat?.wordOrder ?? []);
            const mine = shuffled(all.filter(w => planned.has(w.id)));
            return mine.length >= HIDDEN_COUNT ? mine : [...mine, ...shuffled(all.filter(w => !planned.has(w.id)))];
        },
        page: () => env.IsProd ? (page ??= readFile('./assets/duel.html', 'utf8')) : readFile('./assets/duel.html', 'utf8'),
    };
}
