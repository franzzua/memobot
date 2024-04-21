import { afterEach, test } from "node:test";
import { TaskDatabase } from "../db/taskDatabase";
import { v4 as uuid }  from "uuid";
import { Message, TaskState } from "../types";

test('db task update', async function (){
   const db = new TaskDatabase();
   await db.clear();
   const id = uuid();
   const message = {
      id,
      chatId: '1',
      createdAt: new Date(),
      content: 'Test content',
      details: 'Test details',
      number: 0,
   };
   const task = {
      id: uuid(),
      state: 1,
      index: 0,
      date: new Date(),
      messageId: id
   };
   await db.addOrUpdateChat({id: '1', userId: '1', username: ''});
   await db.addMessage(message, [task]);
   if (await db.getNextTask() === null)
      throw 'task not added';
   await db.updateTaskState({id: task.id, state: TaskState.succeed});
   if (await db.getNextTask() != null)
      throw 'task left in db';
});

afterEach(async () => {
   const db = new TaskDatabase();
   await db.clear();
})