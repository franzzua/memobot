import { Logger } from "./logger";
import { singleton } from "@cmmn/core";

@singleton()
export class ConsoleLogger extends Logger {
    send(data: any) {
        console.log(data);
    }
}