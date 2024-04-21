type ConstructorOf<T> = new (...args: any[]) => T;

export function inject<T>(dep: ConstructorOf<T>) {
    return function (target: any, context: ClassFieldDecoratorContext<any, T>) {
        context.addInitializer(function (this: any){
            this[context.name] = resolve(dep);
        });
    }
}
export function singleton<TClass extends ConstructorOf<any>>(){
    return function (target: any, context: ClassDecoratorContext<TClass>) {
        factories.set(target, () => new target());
    }
}

export function factory<T>(dep: ConstructorOf<T>, factory: (c: Container) => T) {
    factories.set(dep, factory);
}
// const singletons = new Set<ConstructorOf<any>>();
const factories = new Map<ConstructorOf<any>, (c: Container) => any>();

class Container {

    private instances = new Map<ConstructorOf<any>, any>();
    private consts = new Map<ConstructorOf<any>, any>();
    private overrides = new Map<ConstructorOf<any>, ConstructorOf<any>>();
    resolve<T>(dep: ConstructorOf<T>) {
        if (this.overrides.has(dep))
            dep = this.overrides.get(dep) as ConstructorOf<T>;
        if (this.consts.has(dep))
            return this.consts.get(dep);
        if (!factories.has(dep))
            return new dep();
        if (this.instances.has(dep))
            return this.instances.get(dep);
        const instance = factories.get(dep)?.(this);
        this.instances.set(dep, instance);
        return instance;
    }

    async [Symbol.asyncDispose](){
        for (let value of this.instances.values()) {
            await value[Symbol.asyncDispose]?.();
            await value[Symbol.dispose]?.();
        }
        this.instances.clear();
    }

    override(dependency: any, override: any) {
        this.overrides.set(dependency, override);
    }

}

export const defaultContainer = new Container();
export const resolve: <T>(dep: ConstructorOf<T>) => T = defaultContainer.resolve.bind(defaultContainer);