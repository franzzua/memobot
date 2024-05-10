import { Logger } from "./logger";
import { singleton } from "@di";

@singleton()
export class ConsoleLogger extends Logger {
    send(data: any) {
        console.log(data);
    }
}