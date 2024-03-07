import {GoogleSpreadsheet, GoogleSpreadsheetWorksheet} from 'google-spreadsheet';
import {Task} from "./task.store";
import { JWT } from 'google-auth-library'
import * as process from "node:process";

const privateKeyEnv = process.env.GOOGLE_SHEET_PRIVATE_KEY!;
let privateKey = ''
privateKey = '-----BEGIN PRIVATE KEY-----\n';
for (let i = 0; i < privateKeyEnv.length; i+=64){
    privateKey += privateKeyEnv.substring(i, i + 64)+'\n';
}
privateKey += '-----END PRIVATE KEY-----\n';

const jwt = new JWT({
    email: process.env.GOOGLE_SHEET_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export class MemoDoc{
    private doc = new GoogleSpreadsheet('1f9D92LKxVTTdAmdCnZ80baqEf76fmJMkP0mKHwZ2pa4', jwt);

    public async getTasks(){
        await this.doc.loadInfo();
        return (await Promise.all(
            Object.values(this.doc.sheetsById).map(sheet => new MemoSheet(sheet).getTasks())
        )).flat();
    }

    public async getSheet(task: Task){
        const sheet = this.doc.sheetsById[task.chatId] ?? await this.doc.addSheet({
            sheetId: task.chatId,
            title: task.userName.toString(),
            headerValues: cellNames
        });
        return new MemoSheet(sheet);
    }
}
const cellNames = [
    'Message',
    'Created At',
    '42 min',
    '24 h',
    '42 h',
    '1 week',
    '2 week',
    'month',
    '2 month',
];
export class MemoSheet {
    constructor(private sheet: GoogleSpreadsheetWorksheet) {
    }

    async getTasks(): Promise<Task[]> {
        const rows = await this.sheet.getRows({offset: 0});
        return rows.map(x => ({
            id: x.rowNumber,
            userName: this.sheet.title,
            chatId: this.sheet.sheetId,
            message: x.get(cellNames[0]),
            createdAt: new Date(x.get(cellNames[2])),
            timetable: cellNames.slice(2).map(name => new Date(x.get(name)))
        } as Task));
    }
    async addTask(task: Task){
        const row = await this.sheet.addRow([
            task.message,
            task.createdAt.toISOString(),
            ...task.timetable.map(x => x.toISOString())
        ]);
        task.id = row.rowNumber;
    }

    async updateTask(task: Task){
        if (!task.id) throw new Error(`Task without id`);
        await this.sheet.saveUpdatedCells();
    }

    async setTaskSuccess(id: number, index: number) {
        await this.sheet.loadCells();
        this.sheet.getCell(id - 1, 2 + index).backgroundColor = {red: 0, green: 1, blue: 0, alpha: 0.2};
        await this.sheet.saveUpdatedCells();
    }
    async setTaskFailure(id: number, index: number) {
        await this.sheet.loadCells();
        this.sheet.getCell(id - 1, 2 + index).backgroundColor = {red: 1, green: 0, blue: 0, alpha: 0.2};
        await this.sheet.saveUpdatedCells();
    }
}