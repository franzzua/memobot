import { resolve } from "@cmmn/core";
import type { Word } from "../../prisma/client";
import { AiModel } from "./ai-model";
import { satQuizPrompt } from "./prompts";

function shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export async function generateSatQuiz(target: Word, distractors: Word[]): Promise<{
    question: string;
    answers: string[];
    correct: number;
} | null> {
    const pool = [target, ...distractors];
    shuffleInPlace(pool);
    const correct = pool.findIndex(w => w.id === target.id);

    const raw = await resolve(AiModel).prompt(satQuizPrompt(target, distractors));
    if (!raw) return null;

    let passage: string | null = null;
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed.passage === 'string' && parsed.passage.includes('[BLANK]')) {
                passage = parsed.passage;
            }
        }
    } catch {
        const match = raw.match(/"passage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (match) {
            passage = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            if (!passage.includes('[BLANK]')) passage = null;
        }
    }

    if (!passage) return null;

    const formattedPassage = passage.replace('[BLANK]', '<b>_____</b>');
    const question = `${formattedPassage}\n\nWhich word best completes the passage?`;

    return {
        question,
        answers: pool.map(w => w.word),
        correct,
    };
}
