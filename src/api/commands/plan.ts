import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {GoogleAuth} from "google-auth-library";
import {GoogleSpreadsheet, GoogleSpreadsheetWorksheet} from "google-spreadsheet";
import {gcsConfig} from "../../db/gcs.config";

const sheetsAuth = new GoogleAuth({
    projectId: gcsConfig.projectId,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    keyFile: process.env.SHEETS_SA_KEY_PATH,
});

export async function plan(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const sheetId = process.env.PLAN_SHEET_ID;
    if (!sheetId) {
        return ctx.reply('PLAN_SHEET_ID is not configured');
    }

    const chatId = ctx.chat.toString();
    const messages = await this.chatDatabase.getMessagesByKind(chatId, ['word', 'quiz']);
    const wordMessages = messages.filter(x => x.kind === 'word' && !x.deleted);
    const quizMessages = messages.filter(x => x.kind === 'quiz' && !x.deleted);

    const wordRows = wordMessages
        .map(m => ({
            word: m.content,
            description: m.details,
            dates: [...m.dates].sort((a, b) => +a - +b),
        }))
        .sort((a, b) => (+a.dates[0] || 0) - (+b.dates[0] || 0));
    const maxDates = wordRows.reduce((m, r) => Math.max(m, r.dates.length), 0);

    const quizDates: Date[] = [];
    for (const m of quizMessages) {
        for (const date of m.dates) quizDates.push(date);
    }
    quizDates.sort((a, b) => +a - +b);

    if (wordRows.length === 0 && quizDates.length === 0) {
        return ctx.reply('No plan yet. Run /init to build one.');
    }

    const authClient = await sheetsAuth.getClient();
    const doc = new GoogleSpreadsheet(sheetId, {
        getRequestHeaders: () => authClient.getRequestHeaders() as Promise<any>,
    });
    await doc.loadInfo();

    const wordsHeader = ['word', 'description', ...Array.from({length: maxDates}, (_, i) => `scheduledAt_${i + 1}`)];
    const wordsSheet = await ensureSheet(doc, `words ${chatId}`, wordsHeader);
    if (wordRows.length > 0) {
        await wordsSheet.addRows(wordRows.map(r => {
            const row: Record<string, string> = {word: r.word, description: r.description};
            for (let i = 0; i < maxDates; i++) {
                row[`scheduledAt_${i + 1}`] = r.dates[i]?.toISOString() ?? '';
            }
            return row;
        }));
    }

    const quizSheet = await ensureSheet(doc, `quizzes ${chatId}`, ['index', 'scheduledAt']);
    if (quizDates.length > 0) {
        await quizSheet.addRows(quizDates.map((d, i) => ({
            index: String(i + 1),
            scheduledAt: d.toISOString(),
        })));
    }

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${wordsSheet.sheetId}`;
    return ctx.reply(
        `📊 Plan ready: ${url}\nWords: ${wordRows.length}, quizzes: ${quizDates.length}`,
    );
}

async function ensureSheet(
    doc: GoogleSpreadsheet,
    title: string,
    header: string[],
): Promise<GoogleSpreadsheetWorksheet> {
    const existing = doc.sheetsByTitle[title];
    if (existing) {
        await existing.clear();
        await existing.setHeaderRow(header);
        return existing;
    }
    return doc.addSheet({title, headerValues: header});
}
