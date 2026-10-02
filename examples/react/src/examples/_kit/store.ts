import { useSyncExternalStore } from "react";

// A tiny external store: what a grid callback writes and a component outside the grid reads,
// without re-rendering the component that renders the grid. App code, copyable.

export interface Store<T> {
    get(): T;
    set(next: T | ((current: T) => T)): void;
    subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set(next) {
            const updated =
                typeof next === "function"
                    ? (next as (current: T) => T)(value)
                    : next;
            if (Object.is(updated, value)) return;
            value = updated;
            for (const listener of listeners) listener();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

/** The store's value; re-renders when it changes. */
export function useStore<T>(store: Store<T>): T {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}
