import {TelegrafApi} from "../telegraf.api";
import {CommandContext} from "../types";
import {Message, Update} from "@telegraf/types";
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
import {Context} from "telegraf";
import {CallbackQuery} from "@telegraf/types/markup";
import {next} from "./next";

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
    image, voice, next
} as Record<string, Command>;

export const callbacks: Record<string, Callback> = {
    ...paymentCallbacks
}

export type Command = (this: TelegrafApi, ctx: CommandContext) => Promise<Message>;
export type Callback = (this: TelegrafApi, ctx: Context<Update.CallbackQueryUpdate<CallbackQuery.DataQuery>>) => Promise<any>;