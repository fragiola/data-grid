// The server-side example's fetch policy (Epic #153), framework-free: the app hands it the query
// its grid's state makes, each time it changes, and it fetches, keeping the last answer while the
// next one loads and dropping an answer to a query the app has moved on from. App code, copyable.

/** What a server query holds: the last answer, and whether the next one is on its way. */
export interface ServerQueryState<A> {
    readonly answer: A | undefined;
    readonly loading: boolean;
}

export interface ServerQuery<Q, A> {
    /** the last answer, and whether one is loading: a new object on every change */
    readonly state: ServerQueryState<A>;
    /** asks for `query` (nothing when it is the one asked last) */
    ask(query: Q): void;
    /** listens to state changes; returns the unsubscription */
    subscribe(listener: () => void): () => void;
}

/**
 * A query fetched with `fetch`, `same` telling two queries apart (a new object of the same values
 * is the same query).
 */
export function createServerQuery<Q, A>(
    fetch: (query: Q) => Promise<A>,
    same: (a: Q, b: Q) => boolean = (a, b) =>
        JSON.stringify(a) === JSON.stringify(b),
): ServerQuery<Q, A> {
    let state: ServerQueryState<A> = { answer: undefined, loading: false };
    let last: { readonly query: Q } | null = null;
    const listeners = new Set<() => void>();
    const set = (next: ServerQueryState<A>) => {
        state = next;
        for (const listener of [...listeners]) listener();
    };
    return {
        get state() {
            return state;
        },
        ask(query) {
            if (last && same(last.query, query)) return;
            const asked = { query };
            last = asked;
            set({ ...state, loading: true });
            fetch(query).then((answer) => {
                // an answer to a query the app has moved on from is dropped
                if (last === asked) set({ answer, loading: false });
            });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
