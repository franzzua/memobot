import type {ConstructorOf, Factory, InjectionToken} from './types';


export class Container {
	constructor(private parent: Container | null = null) {
	}

	public static Default: Container = new Container();
	private instances = new Map<InjectionToken, unknown>();
	private consts = new Map<InjectionToken, unknown>();
	private overrides = new Map<
		InjectionToken,
		InjectionToken
	>();
	private factories = new Map<
		InjectionToken,
		Factory<unknown>
	>();

	protected getOverride<T>(dep: InjectionToken<T>) {
		return this.overrides.get(dep) ?? this.parent?.getOverride(dep) ?? dep;
	}
	get rootContainer(): Container {
		return this.parent ? this.parent.rootContainer : this;
	}

	protected getResolved<T, TArgs extends unknown[] = []>(dep: InjectionToken<T, TArgs>): T {
		if ((dep as unknown) === Container) return this as unknown as T;
		if (this.consts.has(dep)) return this.consts.get(dep) as T;
		if (this.instances.has(dep)) return this.instances.get(dep) as T;
		return this.parent?.getResolved(dep)!;
	}

	protected getFactory<T>(dep: InjectionToken<T>): Factory<T> {
		return (this.factories.get(dep) ?? this.parent?.getFactory(dep)) as Factory<T>;
	}

	protected instantiate<T, TArgs extends unknown[] = []>(
		dep: InjectionToken<T, TArgs>,
		...args: TArgs
	): T {
		const oldContainer = Container.Default;
		Container.Default = this;
		const factory = this.getFactory(dep);
		try {
			if (!factory) {
				if (typeof dep !== "function") {
					console.error(dep, ` is not a function.`);
					throw new Error(`Injection of unknown value`);
				}
				return new (dep as any)(...args);
			}
			const instance = factory(this);
			if (factory.isScoped) {
				this.instances.set(dep, instance);
			} else {
				this.rootContainer.instances.set(dep, instance);
			}
			return instance as T;
		} finally {
			Container.Default = oldContainer;
		}
	}

	resolve<T, TArgs extends unknown[] = []>(
		dep: InjectionToken<T, TArgs>,
		...args: TArgs
	): T {
		dep = this.getOverride(dep);
		return this.getResolved(dep) ?? this.instantiate(dep, ...args);
	}

	isScoped(token: InjectionToken) {
		return !!this.getResolved(token);
	}

	async [Symbol.asyncDispose]() {
		for (const value of this.instances.values()) {
			await (value as any)[Symbol.asyncDispose]?.();
			await (value as any)[Symbol.dispose]?.();
		}
		this.instances.clear();
	}

	override<T, TArgs extends unknown[]>(dependency: InjectionToken<T, TArgs>, override: InjectionToken<T, TArgs>) {
		this.overrides.set(dependency, override);
	}

	const<T, TArgs extends unknown[]>(dependency: InjectionToken<T, TArgs>, value: T) {
		this.consts.set(dependency, value);
	}

	factory<T, TArgs extends unknown[]>(dependency: InjectionToken<T, TArgs>, value: (c: Container) => T) {
		this.factories.set(dependency, value);
	}

	scoped<T, TArgs extends unknown[]>(dependency: ConstructorOf<T, TArgs>, ...args: TArgs) {
		this.factories.set(dependency, Object.assign(() => new dependency(...args), {
			isScoped: true
		}) as Factory<T>);
	}

	child() {
		return new Container(this);
	}
}
