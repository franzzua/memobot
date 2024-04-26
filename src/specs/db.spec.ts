import {it, test} from "node:test";
import { TaskDatabase } from "../db/taskDatabase";
import { defaultContainer, inject, resolve } from "@di";
import * as assert from "node:assert";
import { ChatState } from "../types";
import { Logger } from "../logger/logger";
import { ConsoleLogger } from "../logger/console.logger";
defaultContainer.override(Logger, ConsoleLogger);

it('db get count', async function (){
   const db = resolve(TaskDatabase);
   const chatId = '2';
   await db.addOrUpdateChat({
      id: chatId,
      userId: '123',
      username: '123'
   });
   const state = await db.getChatState(chatId);
   assert.equal(state, ChatState.initial);
   console.log(state);
   const x =await  db.getMessageCount(chatId);
   assert.equal(x, 0);
   await db.addMessage(chatId,{
      details: '123',
      content: '123'
   });
   const count2 =await  db.getMessageCount(chatId);
   assert.equal(count2, 1);
   await db.removeChat(chatId);
});

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
