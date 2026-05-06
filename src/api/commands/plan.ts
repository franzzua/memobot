import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {GoogleAuth} from "google-auth-library";
import {GoogleSpreadsheet, GoogleSpreadsheetWorksheet} from "google-spreadsheet";
import {gcsConfig} from "../../db/gcs.config";
import {resolve} from "@cmmn/core";
import {SrsPlanner} from "../../services/srs-planner";

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
    const {words, quizzes} = await resolve(SrsPlanner).projectPlan(chatId);

    if (words.length === 0 && quizzes.length === 0) {
        return ctx.reply('No plan yet. Run /init to build one.');
    }

    const maxDates = words.reduce((m, r) => Math.max(m, r.dates.length), 0);

    const authClient = await sheetsAuth.getClient();
    const doc = new GoogleSpreadsheet(sheetId, {
        getRequestHeaders: () => authClient.getRequestHeaders() as Promise<any>,
    });
    await doc.loadInfo();

    const wordsHeader = ['word', 'description', 'status', ...Array.from({length: maxDates}, (_, i) => `scheduledAt_${i + 1}`)];
    const wordsSheet = await ensureSheet(doc, `words ${chatId}`, wordsHeader);
    if (words.length > 0) {
        await wordsSheet.addRows(words.map(r => {
            const row: Record<string, string> = {
                word: r.word,
                description: r.description,
                status: r.scheduled ? 'scheduled' : 'projected',
            };
            for (let i = 0; i < maxDates; i++) {
                row[`scheduledAt_${i + 1}`] = r.dates[i]?.toISOString() ?? '';
            }
            return row;
        }));
    }

    const quizSheet = await ensureSheet(doc, `quizzes ${chatId}`, ['index', 'scheduledAt', 'status']);
    if (quizzes.length > 0) {
        await quizSheet.addRows(quizzes.map((q, i) => ({
            index: String(i + 1),
            scheduledAt: q.date.toISOString(),
            status: q.scheduled ? 'scheduled' : 'projected',
        })));
    }

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${wordsSheet.sheetId}`;
    return ctx.reply(
        `📊 Plan ready: ${url}\nWords: ${words.length}, quizzes: ${quizzes.length}`,
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
