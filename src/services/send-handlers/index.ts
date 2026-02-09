import {Message, Task} from "../../types";
import {spoiler} from "./spoiler";
import {image} from "./image";
import {voice} from "./voice";
import {ai} from "./ai";
import {emoji} from "./emoji";
import {mnemonic} from "./mnemonic";
import {youglish} from "./youglish";
import {Messenger, Message as MessageData} from "../../messengers/messenger";

export const TaskSendHandlers: TaskSendHandler[] = [
    spoiler,
    voice,
    image,
    ai,
    emoji,
    mnemonic,
    youglish
];

export type TaskSendHandler = (task: Message) => Promise<MessageData | string | undefined>;
