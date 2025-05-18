import {it, test} from "node:test";
import { ChatsDatabase } from "../db/chatsDatabase";
import { inject, resolve } from "@di";
import * as assert from "node:assert";

it('di resolve', async function (){
   const test = resolve(Test);
   assert.ok(test.db);
   const test2 = resolve(Test);
   assert.equal(test.db, test2.db);
   assert.notEqual(test, test2);
});


class Test {
   @inject(ChatsDatabase)
   db!: ChatsDatabase;

   private isDbOk = this.db != null;

   constructor() {
      assert.ok(this.db);
      assert.ok(this.isDbOk);
   }
}
