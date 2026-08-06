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
    return `Write a relatively short sentence using the English word "${word}"${meaningClause(description)} to demonstrate an example of how it is used in a natural context that matches CEFR B1-B2 level. Avoid military, depressive, weird, creepy, triggering, alarming or any globally taboo contexts — instead, write a nice and uplifting memorable sentence that encourages memorizing the word. Return the sentence only.`;
}

// Illustration prompt for the image generator, themed around an example sentence.
export function imagePrompt(example: string): string {
    return `Create a memorable image in a mix of styles that seamlessly blends 2D rubber hose animation with a subtle hint of Pixar cartoons, not too rich in small detail, with a clear composition, the color palette of which mostly revolves around the colors #F68201 and #209DBA (HEX) with the gamma a bit desaturated like pastel and a bit inspired by Wed Anderson’s films, and the plot of which is based on the sentence in ${example}. Do not make any words a visible part of the image at all. The animation is 2D, not 3D. Square or almost square format, no black or white borders at the top and the bottom of the image.`;
}

// SAT-style fill-in-the-blank passage that tests `target` against the given distractors.
// Returns a JSON-only instruction; the caller parses {"passage": "...[BLANK]..."}.
export function satQuizPrompt(target: WordLike, distractors: WordLike[]): string {
    const distractorList = distractors
        .map(w => `"${w.word}" (${w.description ?? w.word})`)
        .join('; ');

    return `You are an experienced SAT Reading & Writing question writer.

Create an authentic SAT-style Reading & Writing passage (2–4 sentences, C1–C2 level).

Target word:
- word: "${target.word}"
- description: "${target.description ?? ''}"

Candidate distractors: ${distractorList}

Rules:
- Use exactly one [BLANK] where the target word belongs.
- The passage must sound authentic to the SAT (literary analysis, history, science, or social science).
- Determine the part of speech of the target word first.
- Select exactly 3 distractors from the candidate list. If fewer than 3 match the required part of speech, generate only the remaining ones.
- All four answer options MUST have the same part of speech as the target word.
- Never mix nouns, verbs, adjectives, or adverbs.
- Distractors must not be direct synonyms of the target word and should require understanding the passage to eliminate.

Before returning the answer, verify:
✓ all four options have the same part of speech;
✓ exactly one option fits the passage naturally.

Return only JSON:
{
  "passage": "...the [BLANK]...",
  "options": ["...", "...", "...", "..."],
  "answer": "${target.word}"
}`;
}
