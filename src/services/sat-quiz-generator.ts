import { resolve } from "@cmmn/core";
import type { Word } from "../../prisma/client";
import { AiModel } from "./ai-model";

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

    const distractorList = distractors
        .map(w => `"${w.word}" (${w.description ?? w.word})`)
        .join('; ');

    const prompt = `You are an SAT question generator. Create a formal academic reading passage at C1–C2 level.

Target word: "${target.word}" — ${target.description ?? ''}
Distractor words: ${distractorList}

Rules:
- All four answer choices must be the same part of speech as the target word.
- The distractor words must NOT be direct synonyms of the target word — they should have distinct meanings so the correct choice depends on understanding the context.
- Write 2–3 sentences of academic prose (literary analysis, history, science, or social science tone, SAT register).
- Place exactly one [BLANK] where the target word belongs.
- The passage context must make the target word clearly correct while the distractors would not fit naturally.

Return ONLY valid JSON with no markdown fences:
{"passage":"...the [BLANK]..."}`;

    const raw = await resolve(AiModel).prompt(prompt);
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
