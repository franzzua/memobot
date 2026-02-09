import {GoogleSpreadsheet} from 'google-spreadsheet';
import {GoogleAuth} from 'google-auth-library';
import {writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const adcAuth = new GoogleAuth({
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
    ],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, adcAuth);

await doc.loadInfo();

const sheet = doc.sheetsByTitle['Command Prompts'];
await sheet.loadCells();
const splitRows = Array(sheet.rowCount).fill(0).map((row, i) => i)
    .filter(x => sheet.getCell(x, 0).value);

function* getTexts(from, to) {
    for (let r = from; r < to; r++) {
        const cell = sheet.getCell(r, 2);
        if (cell.value) yield cell.value;
    }
}

const values = Object.fromEntries(splitRows.map(((r, i) => [
    sheet.getCell(r, 0).value,
    Array.from(getTexts(r + 1, splitRows[i + 1] ?? sheet.rowCount))
])));

const path = fileURLToPath(import.meta.resolve('../src/texts.json'))
await writeFile(path, JSON.stringify(values, null, 2), 'utf8');