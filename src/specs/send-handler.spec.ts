import {describe, test} from "node:test";
import {TaskSendHandler, TaskSendHandlers} from "../services/send-handlers";
import {ai} from "../services/send-handlers/ai";
import {Message, Messenger} from "../messengers/messenger";
import {expect} from "expect";
import {emoji} from "../services/send-handlers/emoji";
import {mnemonic} from "../services/send-handlers/mnemonic";
import {spoiler} from "../services/send-handlers/spoiler";

const mockMessenger = {
    async send(chatId, content, options){
        return content;
    }
} as unknown as Messenger;

function testSendHandler(handler: TaskSendHandler): Promise<string | Message> {
    return handler.call(mockMessenger, {
        ...task,
        details: '',
        messageId: 0,
        chatId: '0',
        index: 0,
        start: 0,
        time: 0,
        userId: 0
    }, false);
}
const task = {
    content: 'Influence',
    details: 'Details'
}
describe('send handlers', () => {

    test('spoiler', async t => {
        const result = await testSendHandler(spoiler) as string;
        expect(result.toLowerCase()).toContain(task.content.toLowerCase())
    });
    test('emoji', async t => {
        const result = await testSendHandler(emoji) as string;
        expect(result.length).toBeGreaterThan(1);
    });
    test('ai', async t => {
        const result = await testSendHandler(ai) as string;
        expect(result.toLowerCase()).toContain(task.content.toLowerCase())
    });
    test('mnemonic', async () => {
        const result = await testSendHandler(mnemonic) as string;
        const lines = result.split('\n');
        for (let i = 0; i < task.content.length; i++) {
            expect(lines[i].startsWith(`<b>${task.content[i].toUpperCase()}</b>`))
        }
    });
})