-- Embedding vector (JSON array of floats) of "word: description", used to pick
-- same-POS, similar-but-not-synonym distractors for quizzes.
ALTER TABLE "Word" ADD COLUMN "embedding" JSONB;
