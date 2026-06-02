import {resolve} from "@cmmn/core";
import type {Word} from "../../prisma/client";
import type {AudioMessage, ImageMessage, Message as MessageData, QuizMessage} from "../messengers/messenger";
import type {Message} from "../types";
import {WordsDatabase} from "../db/wordsDatabase";
import {PrismaSchedulerStorage} from "../db/prismaSchedulerStorage";
import {AiModel} from "./ai-model";
import {TextToSpeech} from "./text-to-speech";
import {ImageRender} from "./image-render";
import {Imagen} from "./imagen";

export type WordSendHandler = (ctx: {
    chatId: string;
    message: Message;
    word: Word;
}) => Promise<MessageData | string | undefined>;

const wordHeader = (word: Word) => `<b>${word.word}</b>`;

const quizHandler: WordSendHandler = async function quizHandler({chatId, word}) {
    const distractors = await pickDistractorWords(chatId, word.id, 3);
    if (distractors.length < 3) {
        return `${wordHeader(word)}\n${word.description ?? ''}`;
    }
    const pool = [word, ...distractors];
    shuffleInPlace(pool);
    const answers = pool.map(w => w.word);
    const correct = pool.findIndex(w => w.id === word.id);
    return {
        type: 'quiz',
        question: word.description ?? word.word,
        answers,
        options: {correct_option_id: correct, allows_multiple_answers: false},
    } as QuizMessage;
};

const voiceTransHandler: WordSendHandler = async function voiceTransHandler({word}) {
    const wordsDb = resolve(WordsDatabase);
    let audio: Buffer | undefined = word.voice ? Buffer.from(word.voice) : undefined;
    if (!audio) {
        audio = await resolve(TextToSpeech).getStream(word.word, 'ogg_opus');
        await wordsDb.setVoice(word.id, audio);
    }
    let transcription = word.transcription?.trim();
    if (!transcription) {
        const ipa = await resolve(AiModel).prompt(
            `Return only the IPA phonetic transcription (in the standard /…/ form, no extra words) for the English word: "${word.word}".`
        );
        transcription = (ipa ?? '').trim();
        if (transcription) await wordsDb.setTranscription(word.id, transcription);
    }
    return {type: 'audio', audio, audioType: 'ogg', caption: transcription || undefined} as AudioMessage;
};

const exampleHandler: WordSendHandler = async function exampleHandler({word}) {
    const example = await ensureExample(word);
    return `${wordHeader(word)}\n<i>${boldWord(example, word.word)}</i>`;
};

const imagenHandler: WordSendHandler = async function imagenHandler({word}) {
    const example = await ensureExample(word);
    let image: Buffer | undefined = word.image ? Buffer.from(word.image) : undefined;
    if (!image) {
        const prompt = `Image in rubberhouse style but #f68201-#209dba desaturated gamma, like pastel or Anderson films, ${example}`;
        image = await resolve(Imagen).generate(prompt);
        if (image) await resolve(WordsDatabase).setImage(word.id, image);
    }
    if (!image) {
        return `${wordHeader(word)}\n<i>${boldWord(example, word.word)}</i>`;
    }
    return {
        type: 'image',
        image,
        caption: `${wordHeader(word)}\n<i>${boldWord(example, word.word)}</i>`,
    } as ImageMessage;
};

const flashcardHandler: WordSendHandler = async function flashcardHandler({word}) {
    const render = new ImageRender(word.word, word.description ?? '');
    return {type: 'image', image: render.render()} as ImageMessage;
};

export const WordSendHandlers: WordSendHandler[] = [
    quizHandler,
    voiceTransHandler,
    exampleHandler,
    imagenHandler,
    flashcardHandler,
];

async function ensureExample(word: Word): Promise<string> {
    if (word.example?.trim()) return word.example.trim();
    const meaningClause = word.description?.trim()
        ? ` in the sense of "${word.description.trim()}"`
        : '';
    const sentence = await resolve(AiModel).prompt(
        `Write one short, natural example sentence using the English word "${word.word}"${meaningClause}. Avoid military or depressive themes. Return only the sentence.`
    );
    const example = (sentence ?? '').trim();
    if (example) await resolve(WordsDatabase).setExample(word.id, example);
    word.example = example;
    return example;
}

function boldWord(sentence: string, word: string): string {
    if (!sentence) return sentence;
    return sentence.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'), m => `<b>${m}</b>`);
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export async function pickDistractorWords(chatId: string, currentWordId: string, n: number): Promise<Word[]> {
    const db = resolve(PrismaSchedulerStorage);
    const plan = await db.getPlanState(chatId);
    if (!plan) return [];
    const introducedCount = await db.countMessagesByKind(chatId, 'word');
    const wordsDb = resolve(WordsDatabase);
    const introducedIds = plan.wordOrder.slice(0, introducedCount).filter(id => id !== currentWordId);
    const upcomingIds = plan.wordOrder.slice(introducedCount).filter(id => id !== currentWordId);
    const pickFrom = (ids: string[], take: number) => {
        const copy = [...ids];
        shuffleInPlace(copy);
        return copy.slice(0, take);
    };
    const pickedIds = pickFrom(introducedIds, n);
    if (pickedIds.length < n) {
        pickedIds.push(...pickFrom(upcomingIds, n - pickedIds.length));
    }
    const map = await wordsDb.getByIds(pickedIds);
    return pickedIds.map(id => map.get(id)).filter((w): w is Word => !!w);
}
