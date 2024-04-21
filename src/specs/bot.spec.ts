import {test, mock, afterEach, beforeEach, before} from "node:test";
import { resolve, defaultContainer } from "@di";
import { MemoBot, TasksEvent } from "../bot/bot";
import * as assert from "node:assert";
import { TaskDatabase } from "../db/taskDatabase";
import { MockDb } from "./db.mock";
import { ChatState } from "../types";

test('db task update', async function (){
   const bot = resolve(MemoBot);
   const db = resolve(TaskDatabase);
   bot.repeatDurations = [200, 500, 800, 1200, 2000, 3000];
   const onTask = mock.fn();
   await db.addOrUpdateChat({
      id: '1',
      username: 'User',
      userId: '1'
   });
   bot.onTask.addEventListener(TasksEvent.type, onTask);
   await bot.addMessage(`Test message`, 'Test details', '1');
   let time = 0;
   for (let i = 0; i < bot.repeatDurations.length; i++){
      let repeatDuration = bot.repeatDurations[i];
      await delay(repeatDuration - time + 10);
      time += repeatDuration + 10;
      assert.equal(onTask.mock.callCount(), i + 1);
   }
});
before(() => {
   defaultContainer.override(TaskDatabase, MockDb)
})
beforeEach(async () => {
})
afterEach(async () => {
   await defaultContainer[Symbol.asyncDispose]();
})

function delay(time: number){
   return  new Promise(r => setTimeout(r, time));

}