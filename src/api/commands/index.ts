import {TelegrafApi} from "../telegraf.api";
import {image} from "./image";
import {onNewCommand} from "./new";
import {resume, stop} from "./stop-resume";
import {start} from "./start";
import {onDelete, onDeleteLast, onDeleteNumber} from "./delete";
import {list, onListComplete, onListCurrent} from "./list";
import {practice} from "./practice";
import {donate, paymentCallbacks} from "./donate";
import {ai} from "./ai";
import {onQuiz, onQuizDirect, onQuizReversed, onQuizWrite} from "./quiz";
import {wipe} from "./wipe";
import {voice} from "./voice";
import {next} from "./next";
import {CallbackEvent, IncomingMessageEvent} from "../../messengers/messenger";
import {spoiler} from "./spoiler";

export const commands = {
    new: onNewCommand,
    stop,
    resume,
    start,
    delete: onDelete,
    last: onDeleteLast,
    number: onDeleteNumber,
    list,
    current: onListCurrent,
    complete: onListComplete,
    practice,
    donate,
    ai,
    quiz: onQuiz,
    writeQuiz: onQuizWrite,
    directQuiz: onQuizDirect,
    reversedQuiz: onQuizReversed,
    wipe: wipe,
    image, voice, next,
    spoiler
} as Record<string, Command>;

export const callbacks: Record<string, Callback> = {
    ...paymentCallbacks
}

export type Command = (this: TelegrafApi, ctx: IncomingMessageEvent) => Promise<any | void>;
export type Callback = (this: TelegrafApi, ctx: CallbackEvent) => Promise<any | void>;