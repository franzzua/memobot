import {storageContract} from "./storageContract";
import {TestJsonStorage} from "./testJsonStorage";

// TestJsonStorage must satisfy the same DataStore contract as PrismaStorage.
storageContract('TestJsonStorage', {
    create: () => new TestJsonStorage({chats: [{id: 'test-chat'}]}),
});
