// A handle on a grid from outside its root (Epic #23), whatever the framework: `current` is what
// a mounted root hands it (its model and engine), `null` otherwise, and it tells when that
// changes. Each adapter types it (`DataGridRef`) and makes it (`createDataGridRef`).

/** A subscribable handle whose `current` only a root writes (`attachGridHandle`). */
export interface GridHandle<T> {
    readonly current: T | null;
    /** listens to a root taking or releasing it; returns the unsubscription */
    subscribe(listener: () => void): () => void;
}

const noop = () => {};

/** What sets a handle's `current`: kept off the handle, so only a root writes it. */
const writers = new WeakMap<object, (value: unknown) => void>();

/** A new handle, held by no root yet. */
export function createGridHandle<T>(): GridHandle<T> {
    let current: T | null = null;
    const listeners = new Set<() => void>();
    const handle: GridHandle<T> = {
        get current() {
            return current;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
    writers.set(handle, (value) => {
        // written only by `attachGridHandle`, with the value of the handle's own type
        current = value as T | null;
        for (const listener of [...listeners]) listener();
    });
    return handle;
}

/**
 * Hands a root's value to its handle; returns the release. A handle belongs to one mounted root
 * at a time: a second one is told about in the console and does not take it, rather than breaking
 * the page for a mistake the types cannot see. `part` names the root's prop in the messages.
 */
export function attachGridHandle<T>(
    handle: GridHandle<T>,
    value: T,
    part = "<DataGrid.Root gridRef>",
): () => void {
    const write = writers.get(handle);
    if (!write) {
        console.error(
            `${part}: the ref must come from useDataGridRef() or createDataGridRef()`,
        );
        return noop;
    }
    if (handle.current && handle.current !== value) {
        console.error(
            `${part}: this ref is already held by another mounted root; give each root its own`,
        );
        return noop;
    }
    write(value);
    return () => {
        if (handle.current === value) write(null);
    };
}
