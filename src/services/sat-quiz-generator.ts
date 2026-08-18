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

// "a [BLANK]" / "an [BLANK]" leaks the answer: the article only agrees with some of
// the options. SAT questions print "a/an" instead, so the article carries no hint.
// Matches the raw [BLANK] marker and the rendered blank alike, so quizzes cached
// before this rule are fixed on their way out of the cache too.
export function collapseArticleBeforeBlank(passage: string): string {
    return passage.replace(/\b(a|an)(\s+)(?=\[BLANK\]|<b>_+<\/b>)/gi, (_m, article: string, space: string) =>
        `${article[0] === article[0].toUpperCase() ? 'A/an' : 'a/an'}${space}`);
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

    const formattedPassage = collapseArticleBeforeBlank(passage).replace('[BLANK]', '<b>_____</b>');
    const question = `${formattedPassage}\n\nWhich choice completes the text with the most logical and precise word or phrase?`;

    return {
        question,
        answers: pool.map(w => w.word),
        correct,
    };
}
