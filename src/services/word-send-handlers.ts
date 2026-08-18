import {resolve} from "@cmmn/core";
import type {Word} from "../../prisma/client";
import type {AudioMessage, ImageMessage, Message as MessageData, QuizMessage} from "../messengers/messenger";
import type {Message} from "../types";
import {WordsDatabase} from "../db/wordsDatabase";
import {PrismaStorage} from "../db/prismaStorage";
import {AiModel} from "./ai-model";
import {TextToSpeech} from "./text-to-speech";
import {ImageRender} from "./image-render";
import {Imagen} from "./imagen";
import {collapseArticleBeforeBlank, generateSatQuiz} from "./sat-quiz-generator";
import {transcriptionPrompt, examplePrompt, imagePrompt} from "./prompts";
import {normalizeWordText, pickSimilarDistractors} from "./distractor-picker";

export type CachedQuiz = {question: string; answers: string[]; correct: number};

export type WordSendHandler = (ctx: {
    chatId: string;
    message: Message;
    word: Word;
}) => Promise<MessageData | string | undefined>;

const wordHeader = (word: Word) => `<b>${word.word}</b>`;

// Step 1 of the per-word flow: a simple definition→word poll, cached per word.
const quizHandler: WordSendHandler = async function quizHandler({chatId, word}) {
    const wq = await ensureWordQuiz(chatId, word);
    if (!wq) {
        return `${wordHeader(word)}\n${word.description ?? ''}`;
    }
    return {
        type: 'quiz',
        question: wq.question,
        answers: wq.answers,
        options: {correct_option_id: wq.correct, allows_multiple_answers: false},
    } as QuizMessage;
};

// Returns the word's cached wordQuiz (definition→word poll), building and caching one if absent.
async function ensureWordQuiz(chatId: string, word: Word): Promise<CachedQuiz | null> {
    const cached = word.wordQuiz as CachedQuiz | null;
    if (isCachedQuiz(cached)) return cached;
    const distractors = await pickDistractorWords(chatId, word.id, 3);
    if (distractors.length < 3) return null;
    const pool = [word, ...distractors];
    shuffleInPlace(pool);
    const quiz: CachedQuiz = {
        question: word.description ?? word.word,
        answers: pool.map(w => w.word),
        correct: pool.findIndex(w => w.id === word.id),
    };
    await resolve(WordsDatabase).setWordQuiz(word.id, quiz);
    word.wordQuiz = quiz as any;
    return quiz;
}

// Returns the word's cached SAT quiz (fill-in-the-blank passage), generating and caching one if absent.
export async function ensureSatQuiz(chatId: string, word: Word): Promise<CachedQuiz | null> {
    const cached = word.satQuiz as CachedQuiz | null;
    if (isCachedQuiz(cached)) return {...cached, question: collapseArticleBeforeBlank(cached.question)};
    const distractors = await pickDistractorWords(chatId, word.id, 3);
    if (distractors.length < 3) return null;
    const quiz = await generateSatQuiz(word, distractors);
    if (quiz) {
        await resolve(WordsDatabase).setSatQuiz(word.id, quiz);
        word.satQuiz = quiz as any;
    }
    return quiz;
}

// A cache built before options were deduplicated can hold the same word twice;
// treat it as missing so the quiz is rebuilt with distinct options.
function isCachedQuiz(q: CachedQuiz | null): q is CachedQuiz {
    if (!q || !Array.isArray(q.answers) || q.answers.length === 0) return false;
    const texts = q.answers.map(a => normalizeWordText(a));
    return new Set(texts).size === texts.length;
}

const voiceTransHandler: WordSendHandler = async function voiceTransHandler({word}) {
    const wordsDb = resolve(WordsDatabase);
    let transcription = word.transcription?.trim();
    if (!transcription) {
        const ipa = await resolve(AiModel).prompt(transcriptionPrompt(word.word));
        transcription = (ipa ?? '').trim();
        if (transcription) await wordsDb.setTranscription(word.id, transcription);
    }
    let audio: Buffer | undefined = word.voice ? Buffer.from(word.voice) : undefined;
    if (!audio) {
        const example = await ensureExample(word);
        audio = await resolve(TextToSpeech).getStream(word.word, 'ogg_opus', transcription || undefined, example || undefined);
        await wordsDb.setVoice(word.id, audio);
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
        image = await resolve(Imagen).generate(imagePrompt(example));
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

// Order matters: SrsPlanner takes a prefix of this list sized to the plan's duration
// (3 reps for short plans, 4 adds the card, 5 adds the example), so shorter reps must
// come first.
export const WordSendHandlers: WordSendHandler[] = [
    quizHandler,
    voiceTransHandler,
    imagenHandler,
    flashcardHandler,
    exampleHandler,
];

async function ensureExample(word: Word): Promise<string> {
    if (word.example?.trim()) return word.example.trim();
    const sentence = await resolve(AiModel).prompt(examplePrompt(word.word, word.description));
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
    const wordsDb = resolve(WordsDatabase);

    // Preferred strategy: same POS, sorted by embedding similarity, synonyms dropped,
    // n at random from the closest SIMILAR_POOL_SIZE. Falls through to a random
    // plan-based pick while POS/embeddings are not yet backfilled — that fallback
    // still restricts to the target's POS (a mismatched-POS option is eliminated by
    // grammar alone, defeating the quiz), just without the similarity ranking.
    const target = await wordsDb.getById(currentWordId);
    const allWords = target ? await wordsDb.getAllLight() : null;
    if (target && allWords) {
        const picked = pickSimilarDistractors(target, allWords, n);
        if (picked.length === n) return picked;
    }

    const db = resolve(PrismaStorage);
    const plan = await db.getPlanState(chatId);
    if (!plan) return [];
    const introducedCount = await db.countMessagesByKind(chatId, 'word');
    const introducedIds = plan.wordOrder.slice(0, introducedCount).filter(id => id !== currentWordId);
    const upcomingIds = plan.wordOrder.slice(introducedCount).filter(id => id !== currentWordId);
    const sameType = target?.type
        ? new Set((allWords ?? []).filter(w => w.type === target.type).map(w => w.id))
        : null;
    const filterByType = (ids: string[]) => sameType ? ids.filter(id => sameType.has(id)) : ids;
    // The word list repeats some spellings under different descriptions, so options
    // are kept unique by text (and never equal to the target) rather than by id.
    const textById = new Map((allWords ?? []).map(w => [w.id, normalizeWordText(w.word)]));
    const usedText = new Set<string>();
    if (target) usedText.add(normalizeWordText(target.word));
    const pickFrom = (ids: string[], take: number) => {
        const copy = [...ids];
        shuffleInPlace(copy);
        const picked: string[] = [];
        for (const id of copy) {
            if (picked.length >= take) break;
            const text = textById.get(id);
            if (text) {
                if (usedText.has(text)) continue;
                usedText.add(text);
            }
            picked.push(id);
        }
        return picked;
    };
    const pickedIds = pickFrom(filterByType(introducedIds), n);
    if (pickedIds.length < n) {
        pickedIds.push(...pickFrom(filterByType(upcomingIds), n - pickedIds.length));
    }
    const map = await wordsDb.getByIds(pickedIds);
    const picked = pickedIds.map(id => map.get(id)).filter((w): w is Word => !!w);
    return dedupeByWordText(picked, target?.word);
}

// Last line of defence for callers that reach here without a word list to filter on:
// drop options that repeat a spelling (or repeat the target). Returning fewer than
// `n` is fine — callers already degrade gracefully when the pool is too small.
function dedupeByWordText(words: Word[], targetWord?: string | null): Word[] {
    const seen = new Set<string>();
    const targetText = normalizeWordText(targetWord);
    if (targetText) seen.add(targetText);
    return words.filter(w => {
        const text = normalizeWordText(w.word);
        if (!text || !seen.has(text)) {
            if (text) seen.add(text);
            return true;
        }
        return false;
    });
}
