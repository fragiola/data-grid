// A cache of items loaded by blocks: ask for a range, and only the blocks not loaded or loading
// are requested. App code, copyable: the data grid only says which range is in view; what to
// load, and how to keep it, is the app's.

export interface RangeCache<T> {
    /** the item at `index`, or `undefined` while it is not loaded */
    get(index: number): T | undefined;
    /** loads the blocks covering `[start, end)` that are neither loaded nor loading */
    ensure(start: number, end: number): void;
    /** listens to blocks arriving, with the range of items each brings; returns the unsubscription */
    subscribe(
        listener: (range: { start: number; end: number }) => void,
    ): () => void;
}

/**
 * A cache of `blockSize`-item blocks, each fetched with `load(start, end)` (the block's range,
 * clamped to `total`). A block is requested once, even when asked for again while it loads.
 */
export function createRangeCache<T>(
    total: number,
    blockSize: number,
    load: (start: number, end: number) => Promise<T[]>,
): RangeCache<T> {
    const blocks = new Map<number, T[]>();
    const loading = new Set<number>();
    const listeners = new Set<
        (range: { start: number; end: number }) => void
    >();

    return {
        get(index) {
            return blocks.get(Math.floor(index / blockSize))?.[
                index % blockSize
            ];
        },
        ensure(start, end) {
            const first = Math.floor(Math.max(0, start) / blockSize);
            const last = Math.floor((Math.min(end, total) - 1) / blockSize);
            for (let block = first; block <= last; block++) {
                if (blocks.has(block) || loading.has(block)) continue;
                loading.add(block);
                const from = block * blockSize;
                const to = Math.min(from + blockSize, total);
                load(from, to).then(
                    (items) => {
                        loading.delete(block);
                        blocks.set(block, items);
                        for (const listener of listeners) {
                            listener({ start: from, end: to });
                        }
                    },
                    // a failed block is asked for again the next time it is in view
                    () => loading.delete(block),
                );
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
