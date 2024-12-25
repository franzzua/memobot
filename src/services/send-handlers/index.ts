import {TaskSender} from "../task-sender";
import {Task} from "../../types";
import {spoiler} from "./spoiler";
import {image} from "./image";
import {voice} from "./voice";
import {ai} from "./ai";
import {emoji} from "./emoji";
import {mnemonic} from "./mnemonic";
import {youglish} from "./youglish";

export const TaskSendHandlers: TaskSendHandler[] = [
    spoiler,
    voice,
    image,
    ai,
    emoji,
    mnemonic,
    youglish
];

export type TaskSendHandler = (this: TaskSender, task: Task, skipNotification: boolean) => Promise<any>;
