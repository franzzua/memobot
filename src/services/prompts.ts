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
    return `Write a relatively short sentence using the English word "${word}"${meaningClause(description)} to demonstrate an example of how it is used in a natural context that matches CEFR B1-B2 level. Avoid military, depressive or any globally taboo contexts — instead, write a nice and memorable sentence that encourages memorizing the word. Return the sentence only.`;
}

// Illustration prompt for the image generator, themed around an example sentence.
export function imagePrompt(example: string): string {
    return `Create a memorable image in a mix of styles that seamlessly blends rubber hose animation with a hint of Pixar cartoons, the color palette of which mostly revolves around the colors #F68201 and #209DBA (HEX) with the gamma a bit desaturated like pastel and a bit inspired by Wed Anderson’s films, and the plot of which is based on the sentence in ${example}.`;
}

// SAT-style fill-in-the-blank passage that tests `target` against the given distractors.
// Returns a JSON-only instruction; the caller parses {"passage": "...[BLANK]..."}.
export function satQuizPrompt(target: WordLike, distractors: WordLike[]): string {
    const distractorList = distractors
        .map(w => `"${w.word}" (${w.description ?? w.word})`)
        .join('; ');

    return `You are a qualified experienced SAT Reading & Writing question writer. Create a formal academic reading passage at C1–C2 level that is either based on the recent test papers or is highly resemblant of them in terms of the style, content and authenticity.

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
}
