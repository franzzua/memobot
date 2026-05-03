import type { Quiz } from "../../prisma/client";
import type { Message } from "../messengers/messenger";

export type QuizPayload = Message | { type: 'text'; text: string };

export function renderQuiz(quiz: Quiz): QuizPayload[] {
    const payloads: QuizPayload[] = [];
    const { description, pollQuestion } = splitQuestion(quiz.question);

    if (description) {
        payloads.push({ type: 'text', text: formatQuestionHtml(description) });
    }

    if (quiz.attachment) {
        payloads.push({ type: 'image', image: Buffer.from(quiz.attachment) });
    } else if (quiz.table_md) {
        payloads.push({ type: 'text', text: `<pre>${quiz.table_md}</pre>` });
    }

    const labels = ['A', 'B', 'C', 'D'];
    const answers = quiz.answers as string[];
    const longOptions = answers.some(a => a.length > 100);

    if (longOptions) {
        const optionsText = answers.map((a, i) => `<b>${labels[i]}.</b> ${a}`).join('\n\n');
        payloads.push({ type: 'text', text: optionsText });
    }

    payloads.push({
        type: 'quiz',
        question: pollQuestion,
        answers: longOptions ? labels : answers,
        options: {
            correct_option_id: quiz.correct,
            allows_multiple_answers: false,
        }
    });

    return payloads;
}

export function splitQuestion(text: string): { description: string; pollQuestion: string } {
    const lastBreak = text.lastIndexOf('\n\n');
    if (lastBreak !== -1) {
        return {
            description: text.slice(0, lastBreak).trim(),
            pollQuestion: text.slice(lastBreak + 2).trim(),
        };
    }
    const match = text.match(/^([\s\S]+[.!?])\s+([^.!?]+[?])$/);
    if (match) {
        return { description: match[1].trim(), pollQuestion: match[2].trim() };
    }
    return { description: '', pollQuestion: text.trim() };
}

export function formatQuestionHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let blockquoteLines: string[] = [];
    for (const line of lines) {
        if (line.startsWith('> ')) {
            blockquoteLines.push(line.slice(2));
        } else {
            if (blockquoteLines.length > 0) {
                result.push(`<blockquote>${blockquoteLines.join('\n')}</blockquote>`);
                blockquoteLines = [];
            }
            result.push(line);
        }
    }
    if (blockquoteLines.length > 0) {
        result.push(`<blockquote>${blockquoteLines.join('\n')}</blockquote>`);
    }
    return result.join('\n').trim();
}
