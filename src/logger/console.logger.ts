import { Logger } from "./logger";

export class ConsoleLogger extends Logger {
    send(data: any) {
        console.log(data);
    }
}