import {test} from "node:test";
import { TaskDatabase } from "../db/taskDatabase";
import { v4 as uuid }  from "uuid";
import { TaskState } from "../types";

test('db task update', async function (){
   const db = new TaskDatabase();
   await db.clear();
   const id = uuid();
   const message = {
      id,
      chatId: 1,
      createdAt: new Date(),
      content: 'Test content',
      details: 'Test details',
      chat: {
         id: 1,
         userId: 'Test user Id',
         username: 'Test username'
      },
      tasks: [{
         id: uuid(),
         state: 1,
         date: new Date(),
         messageId: id
      }]
   };
   await db.addMessage(message);
   const tasks = await db.getNextTasks();
   const added = tasks.find(x => x.id == message.tasks[0].id);
   if (added === null)
      throw 'task not added';
   await db.updateTaskState({id: message.tasks[0].id, state: TaskState.succeed});
   const tasks2 = await db.getNextTasks();
   const rest = tasks2.find(x => x.id == message.tasks[0].id);
   if (rest != null)
      throw 'task left in db';
});