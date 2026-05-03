import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {GoogleAuth} from "google-auth-library";
import {GoogleSpreadsheet} from "google-spreadsheet";
import {gcsConfig} from "../../db/gcs.config";

const sheetsAuth = new GoogleAuth({
    projectId: gcsConfig.projectId,
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
    ],
});

export async function plan(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const sharedDriveId = process.env.SHARED_DRIVE_ID;
    if (!sharedDriveId) {
        return ctx.reply('SHARED_DRIVE_ID is not configured');
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
    const title = `Memobot plan ${new Date().toISOString().slice(0, 10)} #${chatId}`;

    const created = await authClient.request<{id: string}>({
        url: 'https://www.googleapis.com/drive/v3/files',
        method: 'POST',
        params: {supportsAllDrives: true, fields: 'id'},
        data: {
            name: title,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [sharedDriveId],
        },
    });
    const spreadsheetId = created.data.id;

    const doc = new GoogleSpreadsheet(spreadsheetId, {
        getRequestHeaders: () => authClient.getRequestHeaders() as Promise<any>,
    });
    await doc.loadInfo();

    const wordsSheet = doc.sheetsByIndex[0];
    await wordsSheet.updateProperties({title: 'words'});
    const wordsHeader = ['word', 'description', ...Array.from({length: maxDates}, (_, i) => `scheduledAt_${i + 1}`)];
    await wordsSheet.setHeaderRow(wordsHeader);
    if (wordRows.length > 0) {
        await wordsSheet.addRows(wordRows.map(r => {
            const row: Record<string, string> = {word: r.word, description: r.description};
            for (let i = 0; i < maxDates; i++) {
                row[`scheduledAt_${i + 1}`] = r.dates[i]?.toISOString() ?? '';
            }
            return row;
        }));
    }

    const quizSheet = await doc.addSheet({title: 'quizzes', headerValues: ['index', 'scheduledAt']});
    if (quizDates.length > 0) {
        await quizSheet.addRows(quizDates.map((d, i) => ({
            index: String(i + 1),
            scheduledAt: d.toISOString(),
        })));
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return ctx.reply(
        `📊 Plan ready: ${url}\nWords: ${wordRows.length}, quizzes: ${quizDates.length}`,
    );
}
