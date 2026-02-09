import {Container} from './container';
import type {AccessorDecorator, ConstructorOf, FieldDecorator, InjectionToken} from './types';
import {injectLazy} from "./injectLazy";

export const inject = <T, This = unknown>(dep: InjectionToken<T>): AccessorDecorator<This, T> & FieldDecorator<This, T> => {
	return injectLazy(() => dep);
}

export function scoped<TClass extends ConstructorOf<unknown>>() {
	return (target: ConstructorOf<unknown>, context: ClassDecoratorContext<TClass>) => {
		di.scoped(target);
	};
}

export function singleton<TClass extends ConstructorOf<unknown>>() {
	return (target: ConstructorOf<unknown>, context: ClassDecoratorContext<TClass>) => {
		di.factory(target, () => new target());
	};
}

export function factory<T>(
	dep: ConstructorOf<T>,
	factory: (c: Container) => T,
) {
	di.factory(dep, Object.assign(factory, { isScoped: true}));
}


export const di = Container.Default;
export const resolve = <T>(dep: InjectionToken<T>) =>
	Container.Default.resolve(dep);

export { Container };
export type { InjectionToken };
