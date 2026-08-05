// Central place for every AI prompt used to generate word assets.
// Kept together so the wording can be reviewed and tuned in one spot;
// the call sites (admin, word-send-handlers, wordReply, sat-quiz-generator)
// all import from here instead of inlining their own copies.

type WordLike = { word: string; description?: string | null };

const meaningClause = (description?: string | null): string =>
    description?.trim() ? ` in the sense of "${description.trim()}"` : '';

// IPA phonetic transcription, used to drive text-to-speech.
export function transcriptionPrompt(word: string): string {
    return `Return only the IPA phonetic transcription (in the standard /…/ form, no extra words, American English variety) for the English word: "${word}".`;
}

// One short example sentence for a word (optionally pinned to a specific meaning).
export function examplePrompt(word: string, description?: string | null): string {
    return `Write a relatively short sentence using the English word "${word}"${meaningClause(description)} to demonstrate an example of how it is used in a natural context that matches CEFR B1-B2 level. Avoid military, depressive, weird, creepy, triggering, alarming or any globally taboo contexts — instead, write a nice and encouraging memorable sentence that helps memorizing the word. Return the sentence only.`;
}

// Illustration prompt for the image generator, themed around an example sentence.
export function imagePrompt(example: string): string {
    return `Create a memorable image in a mix of styles that seamlessly blends 2D rubber hose animation with a subtle hint of Pixar cartoons, not too rich in small detail, with a clear composition, the color palette of which mostly revolves around the colors #F68201 and #209DBA (HEX) with the gamma a bit desaturated like pastel and a bit inspired by Wed Anderson’s films, and the plot of which is based on the sentence in ${example}. Do not make any words a visible part of the image at all. Square or almost square format, no black or white borders at the top and the bottom of the image.`;
}

// SAT-style fill-in-the-blank passage that tests `target` against the given distractors.
// Returns a JSON-only instruction; the caller parses {"passage": "...[BLANK]..."}.
export function satQuizPrompt(target: WordLike, distractors: WordLike[]): string {
    const distractorList = distractors
        .map(w => `"${w.word}" (${w.description ?? w.word})`)
        .join('; ');

    return `You are a qualified experienced SAT Reading & Writing question writer. Create a formal academic reading passage at C1–C2 level that is either based on the recent test papers or is highly resemblant of them in terms of the volume (2-4 sentences), style, content and authenticity.

Target word: "${target.word}" — ${target.description ?? ''}
Distractor words: ${distractorList}

Rules:
- Absolutely make sure that all four answer options are the same part of speech as the target word, i.e. if the expected answer is an adjective, provide adjectives only as the other 3 options — it's critical.
- The distractor words must NOT be direct synonyms of the target word — they should have distinct meanings so the correct choice depends on understanding the context.
- Write 2–4 sentences of academic prose (literary analysis, history, science, or social science tone, SAT register) which serves as the passage for the missing word.
- Place exactly one [BLANK] where the target word belongs.
- The passage context must make the target word clearly correct while the distractors would not fit naturally.

Return ONLY valid JSON with no markdown fences:
{"passage":"...the [BLANK]..."}`;
}
