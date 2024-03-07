import {GoogleSpreadsheet, GoogleSpreadsheetCell, GoogleSpreadsheetWorksheet} from 'google-spreadsheet';
import {Message, Task} from "./task.store";
import {googleKey} from "./google-key";
import * as process from "node:process";

export class MemoDoc{
    private doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, googleKey);

    public async getTasks(){
        await this.doc.loadInfo();
        return (await Promise.all(
            Object.values(this.doc.sheetsById).map(sheet => new MemoSheet(sheet).getTasks())
        )).flat();
    }

    public async getSheet(task: Message): Promise<MemoSheet>{
        const sheet = this.doc.sheetsById[task.chatId] ?? await this.doc.addSheet({
            sheetId: task.chatId,
            title: task.userName || task.chatId.toString(),
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

    async getTasks(): Promise<Message[]> {
        try {
            await this.sheet.loadCells();
            const rows = await this.sheet.getRows({offset: 0});
            return rows.map(row => ({
                id: row.rowNumber,
                userName: this.sheet.title,
                chatId: this.sheet.sheetId,
                message: row.get(cellNames[0]),
                createdAt: new Date(row.get(cellNames[2])),
                tasks: cellNames.slice(2).map(name => new Date(row.get(name))).map((date, i) => ({
                    date, state: this.getState(row.rowNumber - 1, 2 + i)
                }))
            } as Message));
        }catch (e){
            console.error(e);
            return [];
        }
    }

    private getState(row: number, column: number): Task['state']{
        const cell = this.sheet.getCell(row, column)
        try {
            const color = cell.backgroundColor;
            if (color.green > 0)
                return 'succeed';
            if (color.red > 0)
                return 'failed';
            if (color.blue > 0)
                return 'pending';
        } catch (e){
        }
        return 'new'
    }
    private getColor(state: Task['state']){
        switch (state){
            case 'new': return {red: 0, green: 0, blue: 0, alpha: 0};
            case 'failed': return {red: 0.9, green: 0, blue: 0.1, alpha: 0.2};
            case 'succeed': return {red: 0, green: 0.9, blue: 0.1, alpha: 0.2};
            case 'pending': return {red: 0, green: 0, blue: 0.9, alpha: 0.2};
        }
    }

    async addMessage(message: Message){
        const row = await this.sheet.addRow([
            message.message,
            message.createdAt.toISOString(),
            ...message.tasks.map(x => x.date.toISOString())
        ]);
        message.id = row.rowNumber;
    }

    async updateTask(task: Message){
        if (!task.id) throw new Error(`Task without id`);
        await this.sheet.saveUpdatedCells();
    }

    async setTaskState(row: number, index: number, state: Task['state']) {
        await this.sheet.loadCells();
        this.sheet.getCell(row - 1, 2 + index).backgroundColor = this.getColor(state)!;
        await this.sheet.saveUpdatedCells();
    }
}