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
import {onQuiz, onQuizDirect, onQuizReversed, onQuizWrite, onDbQuiz} from "./quiz";
import {wipe} from "./wipe";
import {voice} from "./voice";
import {next} from "./next";
import {CallbackEvent, IncomingMessageEvent} from "../../messengers/messenger";
import {spoiler} from "./spoiler";
import {actions} from "./actions";
import {word} from "./word";
import {init, onInitLevel, onInitMonths} from "./init";
import {plan} from "./plan";
import {forceNext} from "./forceNext";
import {histo} from "./histo";

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
    satQuiz: onDbQuiz,
    wipe: wipe,
    image, voice, next,
    spoiler, actions, word, init, plan, forceNext, histo
} as Record<string, Command>;

export const callbacks: Record<string, Callback> = {
    ...paymentCallbacks,
    'init:level:A2': onInitLevel,
    'init:level:B1': onInitLevel,
    'init:level:B2': onInitLevel,
    'init:months:2': onInitMonths,
    'init:months:3': onInitMonths,
    'init:months:4': onInitMonths,
    'init:months:5': onInitMonths,
}

export type Command = (this: TelegrafApi, ctx: IncomingMessageEvent) => Promise<any | void>;
export type Callback = (this: TelegrafApi, ctx: CallbackEvent) => Promise<any | void>;