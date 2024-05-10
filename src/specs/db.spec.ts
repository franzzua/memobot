import {it, test, afterEach} from "node:test";
import { TaskDatabase } from "../db/taskDatabase";
import { defaultContainer, inject, resolve } from "@di";
import * as assert from "node:assert";
import { ChatState } from "../types";
import { Logger } from "../logger/logger";
import { ConsoleLogger } from "../logger/console.logger";
defaultContainer.override(Logger, ConsoleLogger);

const db = resolve(TaskDatabase);
const chatId = '2';

it('db get count', async function (){
   await db.addOrUpdateChat({
      id: chatId,
      userId: '123',
      username: '123'
   });
   await db.addOrUpdateChat({
      id: chatId,
      userId: '123',
      username: '123'
   });
   const { state } = await db.getChatState(chatId);
   assert.strictEqual(state, ChatState.initial);
   await db.updateChatState(chatId, ChatState.setDetails, {content: 'a'});
   const state2 = await db.getChatState(chatId);
   assert.strictEqual(state2.state, ChatState.setDetails);
   assert.strictEqual(state2.stateData.content, 'a');
   const x = await  db.getIdCounter(chatId);
   assert.equal(x, 0);
   await db.addMessage(chatId,{
      details: '123',
      content: '123'
   });
   const count2 = await db.getIdCounter(chatId);
   assert.equal(count2, 1);
});
afterEach(() => db.removeChat(chatId));

async function measure<T>(a: () => Promise<T>, text: string): Promise<T>{
   const now = performance.now();
   const res = await a();
   console.log(text, performance.now() - now);
   return res;
}


class Test {

   @inject(TaskDatabase)
   db!: TaskDatabase;

   private isDbOk = this.db != null;

   constructor() {
      assert.ok(this.db);
      assert.ok(this.isDbOk);
   }
}
