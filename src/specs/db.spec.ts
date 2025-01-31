import {it, test, afterEach} from "node:test";
import { ChatDatabase } from "../db/chatDatabase";
import { di, inject, resolve } from "@di";
import * as assert from "node:assert";
import { ChatState } from "../types";
import { Logger } from "../logger/logger";
import { ConsoleLogger } from "../logger/console.logger";
import { TaskDatabase } from "../db/taskDatabase";
import { Fn } from "@cmmn/core";
di.override(Logger, ConsoleLogger);


// it('db get count', async functions (){
//    const db = resolve(ChatDatabase);
//    const chatId = '2';
//
//    await db.addOrUpdateChat({
//       id: chatId,
//       userId: '123',
//       username: '123'
//    });
//    await db.addOrUpdateChat({
//       id: chatId,
//       userId: '123',
//       username: '123'
//    });
//    const { state } = await db.getChatState(chatId);
//    assert.strictEqual(state, ChatState.initial);
//    await db.updateChatState(chatId, ChatState.setDetails, {content: 'a'});
//    const state2 = await db.getChatState(chatId);
//    assert.strictEqual(state2.state, ChatState.setDetails);
//    assert.strictEqual(state2.stateData.content, 'a');
//    const x = await  db.getIdCounter(chatId);
//    assert.equal(x, 0);
//    await db.addMessage(chatId,{
//       details: '123',
//       content: '123'
//    });
//    const count2 = await db.getIdCounter(chatId);
//    assert.equal(count2, 1);
//    await db.removeChat(chatId)
// });
// it('task use', async functions (){
//    const db = resolve(ChatDatabase);
//    const task = {
//       userId: 1,
//       index: 2,
//       chatId: Fn.ulid(),
//       content: '',
//       messageId: 1,
//       details: '1',
//       start: 1
//    }
//    const taskId = await db.addTask(task);
//    let state = await db.getState(taskId);
//    assert.strictEqual(state, 'initial');
//    const isSucceeded = await db.useTasks(async t => {
//       assert.equal(t.length, 1);
//       assert.equal(t[0].chatId, task.chatId);
//       throw `Error`;
//       // let state = await db.getState(taskId);
//       // assert.strictEqual(state, 'pending');
//    });
//    state = await db.getState(taskId);
//    assert.strictEqual(state, isSucceeded  ? 'finished' : 'initial');
//    await db.clear();
//   
// })