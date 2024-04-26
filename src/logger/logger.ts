import { resolve } from "@di";

export abstract class Logger {
    public abstract send(data: any);

    public measure(func: () => any, action: string){
        const start = performance.now();
        const getDuration = () => Math.round(performance.now() - start);
        try{
            const result = func();
            if (result instanceof Promise) {
                return result.then(x => {
                    this.send({action, duration: getDuration()});
                    return x;
                });
            }
            this.send({action, duration: getDuration()});
            return result;
        } catch (e: any){
            this.send({ action, error: e.message, duration: getDuration()});
            throw e;
        }
    }


    static measure<T extends object, TArgs extends any[]>(
        original: (this: T, ...args: TArgs) => any,
        config: ClassMethodDecoratorContext
    ): any {
        return function (this: T, ...args: TArgs){
            const logger = resolve(Logger);
            return logger.measure(
                () => original.apply(this, args),
                `${this.constructor.name}.${config.name.toString()}`
            )
        }
    }
}